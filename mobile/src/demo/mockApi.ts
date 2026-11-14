/**
 * Browser-only demo API (EXPO_PUBLIC_DEMO=1).
 * Mirrors the server's endpoints with the demo data in data.json so the app can be
 * shown from a single static page. State is kept in memory and, when the browser
 * allows it, in localStorage. Differences from the real server: no passwords hashing,
 * and the "must be at the business" location check is skipped.
 */
import raw from './data.json';
import { networkRoute } from './routing.js';
import { CITIES } from './roadnet.js';
import { haversineKm, locateOnPolyline, cumulativeKm, thin } from './geo.js';

type Review = { score: number; taste: number | null; hygiene: number | null; value: number | null; comment: string; createdAt: string; userName: string; userId?: number; visitId?: number };
type Biz = (typeof raw.businesses)[number] & { reviews: Review[] };
type User = { id: number; name: string; email: string; password: string; role: 'user' | 'owner' | 'admin'; prefs: Record<string, unknown> };
type Visit = { id: number; userId: number; businessId: number; createdAt: string };
type Points = { userId: number; points: number; reason: string; createdAt: string };
type Reservation = { id: number; userId: number; businessId: number; reservedFor: string; partySize: number; note: string; status: string; createdAt: string };

type State = { users: User[]; visits: Visit[]; points: Points[]; reservations: Reservation[]; extraReviews: (Review & { businessId: number })[]; nextId: number };

const KEY = 'lezzetrotasi-demo-v1';
const businesses: Biz[] = raw.businesses as Biz[];

const fresh = (): State => ({
  users: [
    { id: 1, name: 'Demo Kullanıcı', email: 'kullanici@lezzetrotasi.local', password: 'demo123', role: 'user', prefs: {} },
    { id: 2, name: 'Demo İşletme Sahibi', email: 'isletme@lezzetrotasi.local', password: 'demo123', role: 'owner', prefs: {} },
  ],
  visits: [],
  points: [],
  reservations: [],
  extraReviews: [],
  nextId: 100,
});

function load(): State {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return JSON.parse(s) as State;
  } catch {
    // storage unavailable: memory only
  }
  return fresh();
}
let state = load();
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};
const id = () => ++state.nextId;
const now = () => new Date().toISOString();

export class DemoError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const fail = (status: number, msg: string): never => {
  throw new DemoError(status, msg);
};

// The demo owner account owns the first business, like on the server.
const ownerOf = (b: Biz) => (b.id === businesses[0].id ? 2 : null);

const reviewsOf = (b: Biz): Review[] => [
  ...state.extraReviews.filter((r) => r.businessId === b.id).reverse(),
  ...b.reviews,
];

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((a, c) => a + c, 0) / v.length) * 10) / 10 : null;
};

function toBusiness(b: Biz) {
  const rs = reviewsOf(b);
  const average = avg(rs.map((r) => r.score));
  const count = rs.length;
  const { reviews: _r, qrCode: _q, ownerId: _o, ...pub } = b;
  return {
    ...pub,
    rating: {
      count,
      average,
      taste: avg(rs.map((r) => r.taste)),
      hygiene: avg(rs.map((r) => r.hygiene)),
      value: avg(rs.map((r) => r.value)),
      trustScore: Math.round(((3.5 * 5 + (average ?? 0) * count) / (5 + count)) * 100) / 100,
    },
  };
}

function filterList(q: URLSearchParams) {
  const tags = (q.get('tags') || '').split(',').filter(Boolean);
  const cuisines = (q.get('cuisine') || '').split(',').filter(Boolean);
  const maxPrice = Number(q.get('maxPrice') || 0);
  const minRating = Number(q.get('minRating') || 0);
  const reservable = q.get('reservations') === '1';
  return businesses
    .filter((b) => tags.every((t) => b.tags.includes(t)))
    .filter((b) => !cuisines.length || cuisines.includes(b.cuisine))
    .filter((b) => !maxPrice || b.priceLevel <= maxPrice)
    .filter((b) => !reservable || b.acceptsReservations)
    .map(toBusiness)
    .filter((b) => !minRating || (b.rating.average ?? 0) >= minRating);
}

const LEVELS = [
  { name: 'Çaylak', min: 0 },
  { name: 'Gezgin', min: 100 },
  { name: 'Gurme', min: 300 },
  { name: 'Lezzet Elçisi', min: 700 },
  { name: 'Lezzet Ustası', min: 1500 },
];

function rewards(userId: number) {
  const points = state.points.filter((p) => p.userId === userId).reduce((a, p) => a + p.points, 0);
  const mine = state.extraReviews.filter((r) => r.userId === userId);
  const cities = new Set(mine.map((r) => businesses.find((b) => b.id === r.businessId)?.city));
  const stats = { ratingCount: mine.length, cityCount: cities.size, detailedCount: mine.filter((r) => r.comment.length >= 30).length };
  let idx = 0;
  LEVELS.forEach((l, i) => {
    if (points >= l.min) idx = i;
  });
  const next = LEVELS[idx + 1];
  return {
    points,
    level: LEVELS[idx].name,
    nextLevel: next?.name ?? null,
    pointsToNext: next ? next.min - points : 0,
    ...stats,
    drawEntries: Math.floor(stats.ratingCount / 10),
    ratingsToNextEntry: 10 - (stats.ratingCount % 10),
    badges: [
      { id: 'ilk-oy', name: 'İlk Oy', earned: stats.ratingCount >= 1 },
      { id: 'tat-avcisi', name: 'Yöresel Tat Avcısı', earned: stats.ratingCount >= 10 },
      { id: 'yerel-rehber', name: 'Yerel Rehber', earned: stats.ratingCount >= 25 },
      { id: 'rota-kasifi', name: 'Rota Kaşifi', earned: stats.cityCount >= 5 },
      { id: 'detayci', name: 'Detaycı Yorumcu', earned: stats.detailedCount >= 5 },
    ],
  };
}

const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, role: u.role, prefs: u.prefs });
const reservationView = (r: Reservation) => ({
  ...r,
  businessName: businesses.find((b) => b.id === r.businessId)?.name ?? '',
  userName: state.users.find((u) => u.id === r.userId)?.name ?? '',
});

function point(q: URLSearchParams, coordKey: string, cityKey: string, name: string): [number, number] {
  const c = q.get(coordKey);
  if (c) {
    const [lat, lng] = c.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  }
  const city = q.get(cityKey) as keyof typeof CITIES | null;
  if (city && CITIES[city]) return CITIES[city] as [number, number];
  return fail(400, `${name} için bir şehir seçin.`);
}

/** Handles one API call. `token` is "demo-<userId>". */
export async function mockApi(path: string, method: string, body: any, token: string | null): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 120)); // feel like a network call
  const url = new URL(path, 'http://demo');
  const q = url.searchParams;
  const p = url.pathname;
  const me = token ? state.users.find((u) => `demo-${u.id}` === token) ?? null : null;
  const needUser = () => me ?? fail(401, 'Giriş yapmanız gerekiyor.');
  const route = (m: string, re: RegExp) => (method === m ? re.exec(p) : null);
  let m: RegExpExecArray | null;

  if (route('GET', /^\/meta$/)) return raw.meta;

  if (route('POST', /^\/auth\/login$/)) {
    const u = state.users.find((x) => x.email === String(body.email || '').trim().toLowerCase() && x.password === body.password);
    if (!u) fail(401, 'E-posta veya şifre hatalı. Demo: kullanici@lezzetrotasi.local / demo123');
    return { token: `demo-${u!.id}`, user: publicUser(u!) };
  }
  if (route('POST', /^\/auth\/register$/)) {
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'Geçerli bir e-posta adresi girin.');
    if (String(body.password || '').length < 6) fail(400, 'Şifre en az 6 karakter olmalı.');
    if (state.users.some((u) => u.email === email)) fail(409, 'Bu e-posta ile kayıtlı bir hesap var.');
    const u: User = { id: id(), name: String(body.name || 'Gezgin').trim(), email, password: body.password, role: 'user', prefs: {} };
    state.users.push(u);
    save();
    return { token: `demo-${u.id}`, user: publicUser(u) };
  }
  if (route('GET', /^\/me$/)) {
    const u = needUser();
    return { user: publicUser(u), rewards: rewards(u.id) };
  }
  if (route('PUT', /^\/me\/prefs$/)) {
    const u = needUser();
    u.prefs = { tags: body.tags ?? [], cuisines: body.cuisines ?? [], maxPrice: body.maxPrice ?? null };
    save();
    return { prefs: u.prefs };
  }
  if (route('GET', /^\/me\/visits$/)) {
    const u = needUser();
    return state.visits
      .filter((v) => v.userId === u.id)
      .reverse()
      .map((v) => {
        const b = businesses.find((x) => x.id === v.businessId)!;
        const r = state.extraReviews.find((x) => x.visitId === v.id);
        return { id: v.id, createdAt: v.createdAt, businessId: b.id, businessName: b.name, city: b.city, ratedScore: r?.score ?? null, canRate: !r };
      });
  }
  if (route('GET', /^\/me\/reservations$/)) {
    const u = needUser();
    return state.reservations.filter((r) => r.userId === u.id).map(reservationView);
  }
  if (route('GET', /^\/owner\/reservations$/)) {
    const u = needUser();
    return state.reservations.filter((r) => ownerOf(businesses.find((b) => b.id === r.businessId)!) === u.id).map(reservationView);
  }

  if (route('GET', /^\/businesses$/)) {
    let items = filterList(q) as (ReturnType<typeof toBusiness> & { distanceKm?: number })[];
    const lat = Number(q.get('lat'));
    const lng = Number(q.get('lng'));
    const radiusKm = Number(q.get('radiusKm') || 15);
    if (q.get('lat') && q.get('lng')) {
      items = items
        .map((b) => ({ ...b, distanceKm: Math.round(haversineKm([lat, lng], [b.lat, b.lng]) * 10) / 10 }))
        .filter((b) => b.distanceKm! <= radiusKm)
        .sort((a, b) => a.distanceKm! - b.distanceKm!);
    }
    return items;
  }
  if ((m = route('GET', /^\/businesses\/(\d+)$/))) {
    const b = businesses.find((x) => x.id === Number(m![1])) ?? fail(404, 'İşletme bulunamadı.');
    return {
      ...toBusiness(b),
      ratings: reviewsOf(b).map((r, i) => ({ id: i + 1, ...r })),
      products: raw.products.filter((x) => x.city === b.city),
    };
  }

  if (route('GET', /^\/route$/)) {
    const from = point(q, 'from', 'fromCity', 'Başlangıç');
    const to = point(q, 'to', 'toCity', 'Varış');
    const corridorKm = Number(q.get('corridorKm') || 10);
    const r = networkRoute(from, to);
    const cum = cumulativeKm(r.points);
    const stops = filterList(q)
      .map((b) => {
        const loc = locateOnPolyline([b.lat, b.lng], r.points, cum);
        return { ...b, offRouteKm: Math.round(loc.offRouteKm * 10) / 10, alongKm: Math.round(loc.alongKm) };
      })
      .filter((b) => b.offRouteKm <= corridorKm)
      .sort((a, b) => a.alongKm - b.alongKm);
    const products = raw.products
      .map((x) => ({ ...x, ...locateOnPolyline([x.lat, x.lng], r.points, cum) }))
      .filter((x) => x.offRouteKm <= 25)
      .sort((a, b) => a.alongKm - b.alongKm)
      .map(({ offRouteKm: _o, alongKm, ...x }) => ({ ...x, alongKm: Math.round(alongKm) }));
    const cities = new Set([...stops.map((s) => s.city), ...products.map((x) => x.city)]);
    return {
      route: { points: thin(r.points), distanceKm: Math.round(r.distanceKm ?? 0), durationMin: Math.round(r.durationMin), source: r.source },
      corridorKm,
      stops,
      products,
      campaigns: raw.campaigns.filter((c) => !c.city || cities.has(c.city)),
    };
  }

  if (route('POST', /^\/visits$/)) {
    const u = needUser();
    const code = String(body.qr || '').trim().replace(/^lezzetrotasi:/, '');
    const b = businesses.find((x) => x.qrCode === code) ?? fail(404, 'QR kod tanınmadı. Demo kodları: demo-qr-1 … demo-qr-38');
    const v: Visit = { id: id(), userId: u.id, businessId: b.id, createdAt: now() };
    state.visits.push(v);
    save();
    return { visitId: v.id, businessId: b.id, businessName: b.name };
  }
  if (route('POST', /^\/ratings$/)) {
    const u = needUser();
    const v = state.visits.find((x) => x.id === Number(body.visitId) && x.userId === u.id) ?? fail(404, 'Ziyaret bulunamadı.');
    if (state.extraReviews.some((r) => r.visitId === v.id)) fail(409, 'Bu ziyaret için zaten puan verdiniz.');
    const score = Number(body.score);
    if (!(score >= 1 && score <= 5)) fail(400, 'Lütfen genel puanı seçin.');
    const b = businesses.find((x) => x.id === v.businessId)!;
    const comment = String(body.comment || '').trim().slice(0, 1000);
    const newCity = !state.extraReviews.some((r) => r.userId === u.id && businesses.find((x) => x.id === r.businessId)?.city === b.city);
    const parts = u.name.split(' ');
    state.extraReviews.push({
      businessId: b.id,
      visitId: v.id,
      userId: u.id,
      userName: parts.map((s, i) => (i === 0 ? s : s[0] + '.')).join(' '),
      score: Math.round(score),
      taste: body.taste ?? null,
      hygiene: body.hygiene ?? null,
      value: body.value ?? null,
      comment,
      createdAt: now(),
    });
    let total = 10;
    state.points.push({ userId: u.id, points: 10, reason: 'Puan verme', createdAt: now() });
    if (comment.length >= 30) {
      total += 5;
      state.points.push({ userId: u.id, points: 5, reason: 'Detaylı yorum', createdAt: now() });
    }
    if (newCity) {
      total += 10;
      state.points.push({ userId: u.id, points: 10, reason: `Yeni şehir: ${b.city}`, createdAt: now() });
    }
    save();
    return { points: total, rewards: rewards(u.id) };
  }

  if (route('POST', /^\/reservations$/)) {
    const u = needUser();
    const when = new Date(body.reservedFor);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 15 * 60 * 1000) fail(400, 'Rezervasyon zamanı en az 15 dakika sonrası olmalı.');
    const r: Reservation = {
      id: id(),
      userId: u.id,
      businessId: Number(body.businessId),
      reservedFor: when.toISOString(),
      partySize: Number(body.partySize),
      note: String(body.note || ''),
      status: 'pending',
      createdAt: now(),
    };
    state.reservations.push(r);
    save();
    return reservationView(r);
  }
  if ((m = route('PATCH', /^\/reservations\/(\d+)$/))) {
    const u = needUser();
    const r = state.reservations.find((x) => x.id === Number(m![1])) ?? fail(404, 'Rezervasyon bulunamadı.');
    const isOwner = ownerOf(businesses.find((b) => b.id === r.businessId)!) === u.id;
    const ok = (r.userId === u.id && body.status === 'cancelled') || (isOwner && ['confirmed', 'rejected', 'cancelled'].includes(body.status));
    if (!ok) fail(403, 'Bu rezervasyonu bu şekilde güncelleyemezsiniz.');
    r.status = body.status;
    save();
    return reservationView(r);
  }

  return fail(404, 'Bulunamadı.');
}

/** Clears the demo's saved state (used by the "reset demo" button). */
export function resetDemo() {
  state = fresh();
  save();
}
