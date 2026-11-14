import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword, issueToken, authOptional, requireRole } from './auth.js';
import { getRoute } from './routing.js';
import { CITIES } from './roadnet.js';
import { haversineKm, locateOnPolyline, cumulativeKm, boundingBox, thin } from './geo.js';
import { POINTS, rewardSummary } from './rewards.js';

export const TAGS = {
  vegan: 'Vegan',
  vejetaryen: 'Vejetaryen',
  glutensiz: 'Glütensiz',
  helal: 'Helal',
  'cocuk-dostu': 'Çocuk dostu',
  'aile-salonu': 'Aile salonu',
  'diyet-menu': 'Diyet menü',
  'engelli-erisimi': 'Engelli erişimi',
  otopark: 'Otopark',
  'yoresel-urun-satisi': 'Yöresel ürün satışı',
};

export const CUISINES = ['Ev yemekleri', 'Kebap & Izgara', 'Pide & Lahmacun', 'Balık', 'Kahvaltı', 'Tatlı', 'Yöresel mutfak', 'Sokak lezzetleri', 'Dünya mutfağı'];

const VISIT_RADIUS_M = Number(process.env.VISIT_RADIUS_M || 300);
const RATING_WINDOW = '7 days';
const RATING_WINDOW_DAYS = 7;
const SAME_BUSINESS_RATING_COOLDOWN = '30 days';
const ACTIVE = `b.contract_status = 'active' AND b.subscription_until >= current_date`;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => new HttpError(400, msg);

// ---------- helpers ----------

const num = (v, name, { min = -Infinity, max = Infinity, optional = false } = {}) => {
  if ((v === undefined || v === null || v === '') && optional) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw bad(`Geçersiz değer: ${name}`);
  return n;
};
const str = (v, name, { max = 500, optional = false } = {}) => {
  if ((v === undefined || v === null || v === '') && optional) return undefined;
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw bad(`Geçersiz değer: ${name}`);
  return v.trim();
};
const list = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);
const idParam = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 2 ** 31 - 1) throw new HttpError(404, 'Bulunamadı.');
  return n;
};

function parsePoint(coord, city, name) {
  if (coord) {
    const [lat, lng] = String(coord).split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return [lat, lng];
    throw bad(`Geçersiz koordinat: ${name}`);
  }
  if (city && CITIES[city]) return CITIES[city];
  throw bad(`${name} için koordinat (lat,lng) veya bilinen bir şehir adı verin.`);
}

const RATING_STATS = `
  LEFT JOIN (SELECT business_id, COUNT(*)::int AS rating_count, AVG(score)::float8 AS avg_score,
                    AVG(taste)::float8 AS avg_taste, AVG(hygiene)::float8 AS avg_hygiene, AVG(value)::float8 AS avg_value
             FROM ratings GROUP BY business_id) rs ON rs.business_id = b.id`;
const BIZ_SELECT = `SELECT b.*, rs.rating_count, rs.avg_score, rs.avg_taste, rs.avg_hygiene, rs.avg_value FROM businesses b ${RATING_STATS}`;

/** Bayesian average so a single 5-star vote does not outrank 200 votes at 4.6. */
function trustScore(avg, count, prior = 3.5, weight = 5) {
  return (prior * weight + (avg || 0) * count) / (weight + count);
}

const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

function toBusiness(row, { includePrivate = false } = {}) {
  const count = Number(row.rating_count || 0);
  const out = {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    cuisine: row.cuisine,
    city: row.city,
    address: row.address,
    phone: row.phone,
    lat: row.lat,
    lng: row.lng,
    priceLevel: Number(row.price_level),
    tags: row.tags,
    specialties: row.specialties,
    openingHours: row.opening_hours,
    acceptsReservations: !!row.accepts_reservations,
    inspected: !!row.inspected_at,
    inspectedAt: row.inspected_at,
    rating: {
      count,
      average: count ? round1(row.avg_score) : null,
      taste: count ? round1(row.avg_taste) : null,
      hygiene: count ? round1(row.avg_hygiene) : null,
      value: count ? round1(row.avg_value) : null,
      trustScore: Math.round(trustScore(row.avg_score, count) * 100) / 100,
    },
  };
  if (includePrivate) {
    Object.assign(out, {
      ownerId: row.owner_id ? Number(row.owner_id) : null,
      qrCode: row.qr_code,
      qrPayload: qrPayload(row.qr_code),
      contractStatus: row.contract_status,
      subscriptionUntil: row.subscription_until,
      inspectedBy: row.inspected_by,
    });
  }
  return out;
}

function filterSql(q) {
  const where = [];
  const params = [];
  const cuisines = list(q.cuisine);
  if (cuisines.length) { where.push(`b.cuisine IN (${cuisines.map(() => '?').join(',')})`); params.push(...cuisines); }
  if (q.maxPrice) { where.push('b.price_level <= ?'); params.push(num(q.maxPrice, 'maxPrice', { min: 1, max: 4 })); }
  for (const t of list(q.tags)) {
    if (!TAGS[t]) throw bad(`Bilinmeyen etiket: ${t}`);
    where.push('b.tags @> jsonb_build_array(?::text)'); params.push(t);
  }
  if (q.q) {
    where.push('(b.name ILIKE ? OR b.specialties::text ILIKE ? OR b.city ILIKE ?)');
    const like = `%${String(q.q).replace(/[\\%_]/g, (c) => '\\' + c)}%`;
    params.push(like, like, like);
  }
  if (q.reservations === '1') where.push('b.accepts_reservations');
  return { sql: where.length ? ' AND ' + where.join(' AND ') : '', params };
}

const minRatingFilter = (q) => {
  const min = num(q.minRating, 'minRating', { min: 1, max: 5, optional: true });
  return (b) => !min || (b.rating.average ?? 0) >= min;
};

const newQr = () => crypto.randomBytes(9).toString('base64url');
const qrPayload = (code) => `lezzetrotasi:${code}`;
const publicUser = (u) => ({ id: Number(u.id), name: u.name, email: u.email, role: u.role, prefs: u.prefs });
const maskName = (n) => n.split(' ').map((p, i) => (i === 0 ? p : p[0] + '.')).join(' ');

// ---------- app ----------

/** @param {import('./db.js').Db} db */
export function createApp(db) {
  const app = express();
  app.set('trust proxy', true); // Cloud Run / load balancer
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use(authOptional);
  app.use('/admin', express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), '../public')));

  const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const loadUser = (id) => db.get('SELECT id, name, email, role, prefs, created_at FROM users WHERE id = ?', id);

  app.get('/api/health', h(async (_req, res) => {
    await db.get('SELECT 1');
    res.json({ ok: true });
  }));

  app.get('/api/meta', (_req, res) => {
    res.json({
      cities: Object.entries(CITIES).map(([name, [lat, lng]]) => ({ name, lat, lng })),
      cuisines: CUISINES,
      tags: Object.entries(TAGS).map(([id, label]) => ({ id, label })),
      priceLevels: [{ level: 1, label: '₺' }, { level: 2, label: '₺₺' }, { level: 3, label: '₺₺₺' }, { level: 4, label: '₺₺₺₺' }],
    });
  });

  // ----- auth -----
  app.post('/api/auth/register', h(async (req, res) => {
    const name = str(req.body.name, 'name', { max: 80 });
    const email = str(req.body.email, 'email', { max: 120 }).toLowerCase();
    const password = String(req.body.password || '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Geçerli bir e-posta adresi girin.');
    if (password.length < 6) throw bad('Şifre en az 6 karakter olmalı.');
    if (await db.get('SELECT 1 FROM users WHERE email = ?', email)) throw new HttpError(409, 'Bu e-posta ile kayıtlı bir hesap var.');
    const id = await db.insert('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', name, email, hashPassword(password));
    const user = await loadUser(id);
    res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  }));

  app.post('/api/auth/login', h(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const row = await db.get('SELECT * FROM users WHERE email = ?', email);
    if (!row || !verifyPassword(String(req.body.password || ''), row.password_hash)) throw new HttpError(401, 'E-posta veya şifre hatalı.');
    res.json({ token: issueToken(row), user: publicUser(row) });
  }));

  app.get('/api/me', requireRole(), h(async (req, res) => {
    const u = await loadUser(req.user.id);
    if (!u) throw new HttpError(401, 'Hesap bulunamadı.');
    res.json({ user: publicUser(u), rewards: await rewardSummary(db, u.id) });
  }));

  app.put('/api/me/prefs', requireRole(), h(async (req, res) => {
    const tags = (Array.isArray(req.body.tags) ? req.body.tags : []).filter((t) => TAGS[t]);
    const cuisines = (Array.isArray(req.body.cuisines) ? req.body.cuisines : []).filter((c) => CUISINES.includes(c));
    const maxPrice = num(req.body.maxPrice, 'maxPrice', { min: 1, max: 4, optional: true }) ?? null;
    const prefs = { tags, cuisines, maxPrice };
    await db.run('UPDATE users SET prefs = ?::jsonb WHERE id = ?', JSON.stringify(prefs), req.user.id);
    res.json({ prefs });
  }));

  app.get('/api/me/points', requireRole(), h(async (req, res) => {
    res.json(await db.all('SELECT points, reason, created_at AS "createdAt" FROM points_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 100', req.user.id));
  }));

  app.get('/api/me/visits', requireRole(), h(async (req, res) => {
    const rows = await db.all(`
      SELECT v.id, v.created_at AS "createdAt", b.id AS "businessId", b.name AS "businessName", b.city,
             r.score AS "ratedScore",
             (r.id IS NULL AND v.created_at >= now() - ?::interval) AS "canRate"
      FROM visits v JOIN businesses b ON b.id = v.business_id
      LEFT JOIN ratings r ON r.visit_id = v.id
      WHERE v.user_id = ? ORDER BY v.id DESC LIMIT 100`, RATING_WINDOW, req.user.id);
    res.json(rows);
  }));

  // ----- discovery -----
  app.get('/api/businesses', h(async (req, res) => {
    const lat = num(req.query.lat, 'lat', { min: -90, max: 90, optional: true });
    const lng = num(req.query.lng, 'lng', { min: -180, max: 180, optional: true });
    const radiusKm = num(req.query.radiusKm ?? 15, 'radiusKm', { min: 0.1, max: 200 });
    const f = filterSql(req.query);
    let sql = `${BIZ_SELECT} WHERE ${ACTIVE}${f.sql}`;
    const params = [...f.params];
    if (req.query.city) { sql += ' AND b.city = ?'; params.push(String(req.query.city)); }
    if (lat !== undefined && lng !== undefined) {
      const box = boundingBox([[lat, lng]], radiusKm);
      sql += ' AND b.lat BETWEEN ? AND ? AND b.lng BETWEEN ? AND ?';
      params.push(box.minLat, box.maxLat, box.minLng, box.maxLng);
    }
    let items = (await db.all(sql, ...params)).map((r) => toBusiness(r)).filter(minRatingFilter(req.query));
    if (lat !== undefined && lng !== undefined) {
      items = items
        .map((b) => ({ ...b, distanceKm: round1(haversineKm([lat, lng], [b.lat, b.lng])) }))
        .filter((b) => b.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    } else {
      items.sort((a, b) => b.rating.trustScore - a.rating.trustScore);
    }
    res.json(items.slice(0, 200));
  }));

  app.get('/api/businesses/:id', h(async (req, res) => {
    const row = await db.get(`${BIZ_SELECT} WHERE b.id = ? AND ${ACTIVE}`, idParam(req.params.id));
    if (!row) throw new HttpError(404, 'İşletme bulunamadı.');
    const business = toBusiness(row);
    const ratings = await db.all(`
      SELECT r.id, r.score, r.taste, r.hygiene, r.value, r.comment, r.created_at AS "createdAt", u.name AS "userName"
      FROM ratings r JOIN users u ON u.id = r.user_id WHERE r.business_id = ? ORDER BY r.id DESC LIMIT 30`, business.id);
    const products = await db.all('SELECT * FROM products WHERE city = ? ORDER BY name', business.city);
    res.json({ ...business, ratings: ratings.map((r) => ({ ...r, userName: maskName(r.userName) })), products });
  }));

  app.get('/api/route', h(async (req, res) => {
    const from = parsePoint(req.query.from, req.query.fromCity, 'Başlangıç');
    const to = parsePoint(req.query.to, req.query.toCity, 'Varış');
    const corridorKm = num(req.query.corridorKm ?? 10, 'corridorKm', { min: 0.5, max: 50 });
    const route = await getRoute(from, to);
    const cum = cumulativeKm(route.points);
    const box = boundingBox(route.points, corridorKm);
    const f = filterSql(req.query);
    const rows = await db.all(
      `${BIZ_SELECT} WHERE ${ACTIVE} AND b.lat BETWEEN ? AND ? AND b.lng BETWEEN ? AND ?${f.sql}`,
      box.minLat, box.maxLat, box.minLng, box.maxLng, ...f.params,
    );
    const stops = rows
      .map((r) => {
        const b = toBusiness(r);
        const loc = locateOnPolyline([b.lat, b.lng], route.points, cum);
        return { ...b, offRouteKm: round1(loc.offRouteKm), alongKm: Math.round(loc.alongKm) };
      })
      .filter((b) => b.offRouteKm <= corridorKm)
      .filter(minRatingFilter(req.query))
      .sort((a, b) => a.alongKm - b.alongKm);

    const productBox = boundingBox(route.points, 25);
    const products = (await db.all('SELECT * FROM products WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?',
      productBox.minLat, productBox.maxLat, productBox.minLng, productBox.maxLng))
      .map((p) => ({ ...p, ...locateOnPolyline([p.lat, p.lng], route.points, cum) }))
      .filter((p) => p.offRouteKm <= 25)
      .sort((a, b) => a.alongKm - b.alongKm)
      .map(({ offRouteKm, alongKm, ...p }) => ({ ...p, alongKm: Math.round(alongKm) }));

    const cities = [...new Set([...stops.map((s) => s.city), ...products.map((p) => p.city)])];
    res.json({
      route: {
        points: thin(route.points),
        distanceKm: Math.round(route.distanceKm),
        durationMin: Math.round(route.durationMin),
        source: route.source,
      },
      corridorKm,
      stops,
      products,
      campaigns: await activeCampaigns(cities),
    });
  }));

  async function activeCampaigns(cities) {
    const params = [];
    let cityCond = 'c.city IS NULL';
    if (cities?.length) { cityCond = `(c.city IS NULL OR c.city IN (${cities.map(() => '?').join(',')}))`; params.push(...cities); }
    const rows = await db.all(`
      SELECT c.id, c.sponsor_type AS "sponsorType", c.sponsor_name AS "sponsorName", c.title, c.body, c.city, c.business_id AS "businessId"
      FROM campaigns c WHERE current_date BETWEEN c.starts_at AND c.ends_at AND ${cityCond} ORDER BY c.id DESC LIMIT 10`, ...params);
    return rows.map((c) => ({ ...c, sponsored: true }));
  }

  app.get('/api/campaigns', h(async (req, res) => res.json(await activeCampaigns(list(req.query.city)))));

  app.get('/api/products', h(async (req, res) => {
    res.json(req.query.city
      ? await db.all('SELECT * FROM products WHERE city = ? ORDER BY name', String(req.query.city))
      : await db.all('SELECT * FROM products ORDER BY city, name'));
  }));

  // ----- visits & ratings -----
  app.post('/api/visits', requireRole(), h(async (req, res) => {
    const raw = str(req.body.qr, 'qr', { max: 200 });
    const code = raw.startsWith('lezzetrotasi:') ? raw.slice('lezzetrotasi:'.length) : raw;
    const lat = num(req.body.lat, 'lat', { min: -90, max: 90 });
    const lng = num(req.body.lng, 'lng', { min: -180, max: 180 });
    const b = await db.get(`SELECT b.id, b.name, b.lat, b.lng FROM businesses b WHERE b.qr_code = ? AND ${ACTIVE}`, code);
    if (!b) throw new HttpError(404, 'QR kod tanınmadı. Lütfen işletmedeki güncel kodu okutun.');
    const distM = haversineKm([lat, lng], [b.lat, b.lng]) * 1000;
    if (distM > VISIT_RADIUS_M) throw new HttpError(422, `Ziyaret onayı için işletmede olmalısınız (yaklaşık ${Math.round(distM)} m uzaktasınız).`);
    const recent = await db.get(`SELECT id FROM visits WHERE user_id = ? AND business_id = ? AND created_at >= now() - interval '6 hours'`, req.user.id, b.id);
    const visitId = recent ? Number(recent.id) : await db.insert('INSERT INTO visits (user_id, business_id) VALUES (?, ?)', req.user.id, b.id);
    res.status(recent ? 200 : 201).json({ visitId, businessId: Number(b.id), businessName: b.name });
  }));

  app.post('/api/ratings', requireRole(), h(async (req, res) => {
    const visitId = num(req.body.visitId, 'visitId', { min: 1, max: 2 ** 31 - 1 });
    const score = num(req.body.score, 'score', { min: 1, max: 5 });
    const sub = (k) => { const v = num(req.body[k], k, { min: 1, max: 5, optional: true }); return v === undefined ? null : Math.round(v); };
    const comment = String(req.body.comment || '').trim().slice(0, 1000);
    const v = await db.get(`SELECT v.*, b.city, (v.created_at >= now() - ?::interval) AS fresh FROM visits v JOIN businesses b ON b.id = v.business_id WHERE v.id = ? AND v.user_id = ?`,
      RATING_WINDOW, visitId, req.user.id);
    if (!v) throw new HttpError(404, 'Ziyaret bulunamadı.');
    if (!v.fresh) throw new HttpError(422, `Ziyaretten sonra en geç ${RATING_WINDOW_DAYS} gün içinde puan verilebilir.`);
    if (await db.get('SELECT 1 FROM ratings WHERE visit_id = ?', visitId)) throw new HttpError(409, 'Bu ziyaret için zaten puan verdiniz.');
    if (await db.get('SELECT 1 FROM ratings WHERE user_id = ? AND business_id = ? AND created_at >= now() - ?::interval', req.user.id, v.business_id, SAME_BUSINESS_RATING_COOLDOWN)) {
      throw new HttpError(429, 'Aynı işletmeye 30 günde bir puan verebilirsiniz.');
    }
    const earned = await db.tx(async (t) => {
      const newCity = !(await t.get('SELECT 1 FROM ratings r JOIN businesses b ON b.id = r.business_id WHERE r.user_id = ? AND b.city = ?', req.user.id, v.city));
      const ratingId = await t.insert('INSERT INTO ratings (user_id, business_id, visit_id, score, taste, hygiene, value, comment) VALUES (?,?,?,?,?,?,?,?)',
        req.user.id, v.business_id, visitId, Math.round(score), sub('taste'), sub('hygiene'), sub('value'), comment);
      const award = (p, reason) => t.run('INSERT INTO points_ledger (user_id, points, reason) VALUES (?, ?, ?)', req.user.id, p, reason);
      let total = POINTS.rating;
      await award(POINTS.rating, 'Puan verme');
      if (comment.length >= 30) { await award(POINTS.detailedComment, 'Detaylı yorum'); total += POINTS.detailedComment; }
      if (newCity) { await award(POINTS.newCity, `Yeni şehir: ${v.city}`); total += POINTS.newCity; }
      return { ratingId, points: total };
    });
    res.status(201).json({ ...earned, rewards: await rewardSummary(db, req.user.id) });
  }));

  // ----- reservations -----
  const RES_SELECT = `
    SELECT r.id, r.business_id AS "businessId", b.name AS "businessName", r.user_id AS "userId", u.name AS "userName",
           r.reserved_for AS "reservedFor", r.party_size AS "partySize", r.note, r.status, r.created_at AS "createdAt"
    FROM reservations r JOIN businesses b ON b.id = r.business_id JOIN users u ON u.id = r.user_id`;
  const reservationById = (id) => db.get(`${RES_SELECT} WHERE r.id = ?`, id);

  app.post('/api/reservations', requireRole(), h(async (req, res) => {
    const businessId = num(req.body.businessId, 'businessId', { min: 1, max: 2 ** 31 - 1 });
    const when = new Date(str(req.body.reservedFor, 'reservedFor', { max: 40 }));
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 15 * 60 * 1000) throw bad('Rezervasyon zamanı en az 15 dakika sonrası olmalı.');
    const partySize = num(req.body.partySize, 'partySize', { min: 1, max: 50 });
    const note = String(req.body.note || '').slice(0, 300);
    const b = await db.get(`SELECT b.id, b.accepts_reservations FROM businesses b WHERE b.id = ? AND ${ACTIVE}`, businessId);
    if (!b) throw new HttpError(404, 'İşletme bulunamadı.');
    if (!b.accepts_reservations) throw new HttpError(422, 'Bu işletme rezervasyon kabul etmiyor.');
    const id = await db.insert('INSERT INTO reservations (user_id, business_id, reserved_for, party_size, note) VALUES (?,?,?,?,?)',
      req.user.id, businessId, when.toISOString(), Math.round(partySize), note);
    res.status(201).json(await reservationById(id));
  }));

  app.get('/api/me/reservations', requireRole(), h(async (req, res) => {
    res.json(await db.all(`${RES_SELECT} WHERE r.user_id = ? ORDER BY r.reserved_for DESC`, req.user.id));
  }));

  app.patch('/api/reservations/:id', requireRole(), h(async (req, res) => {
    const r = await db.get('SELECT r.*, b.owner_id FROM reservations r JOIN businesses b ON b.id = r.business_id WHERE r.id = ?', idParam(req.params.id));
    if (!r) throw new HttpError(404, 'Rezervasyon bulunamadı.');
    const status = String(req.body.status || '');
    const isGuest = Number(r.user_id) === req.user.id;
    const isOwner = r.owner_id && Number(r.owner_id) === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const allowed = (isGuest && status === 'cancelled') || ((isOwner || isAdmin) && ['confirmed', 'rejected', 'cancelled'].includes(status));
    if (!allowed) throw new HttpError(403, 'Bu rezervasyonu bu şekilde güncelleyemezsiniz.');
    if (['rejected', 'cancelled'].includes(r.status)) throw new HttpError(409, 'Rezervasyon zaten kapatılmış.');
    await db.run('UPDATE reservations SET status = ? WHERE id = ?', status, r.id);
    res.json(await reservationById(r.id));
  }));

  // ----- business owner -----
  app.get('/api/owner/businesses', requireRole('owner', 'admin'), h(async (req, res) => {
    const rows = await db.all(`${BIZ_SELECT} WHERE b.owner_id = ? ORDER BY b.id`, req.user.id);
    res.json(rows.map((r) => toBusiness(r, { includePrivate: true })));
  }));

  app.put('/api/owner/businesses/:id', requireRole('owner', 'admin'), h(async (req, res) => {
    const id = idParam(req.params.id);
    const b = await db.get('SELECT owner_id FROM businesses WHERE id = ?', id);
    if (!b || (req.user.role !== 'admin' && Number(b.owner_id) !== req.user.id)) throw new HttpError(404, 'İşletme bulunamadı.');
    await updateBusinessFields(db, id, req.body, ['description', 'phone', 'opening_hours', 'specialties', 'tags', 'accepts_reservations', 'price_level']);
    res.json(await adminBusiness(id));
  }));

  app.get('/api/owner/reservations', requireRole('owner', 'admin'), h(async (req, res) => {
    res.json(await db.all(`${RES_SELECT} WHERE b.owner_id = ? ORDER BY r.reserved_for`, req.user.id));
  }));

  // Printable QR (SVG) for the field team; owners can fetch their own.
  app.get('/api/businesses/:id/qr', requireRole('owner', 'admin'), h(async (req, res) => {
    const b = await db.get('SELECT owner_id, qr_code FROM businesses WHERE id = ?', idParam(req.params.id));
    if (!b || (req.user.role !== 'admin' && Number(b.owner_id) !== req.user.id)) throw new HttpError(404, 'İşletme bulunamadı.');
    const payload = qrPayload(b.qr_code);
    res.json({ payload, svg: await QRCode.toString(payload, { type: 'svg', margin: 2, width: 240 }) });
  }));

  // ----- admin / field team (sözleşme ekibi) -----
  async function adminBusiness(id, conn = db) {
    const r = await conn.get(`${BIZ_SELECT} WHERE b.id = ?`, id);
    return r && toBusiness(r, { includePrivate: true });
  }

  const FIELD_MAP = {
    name: ['name', (v) => str(v, 'name', { max: 120 })],
    description: ['description', (v) => String(v).slice(0, 2000)],
    cuisine: ['cuisine', (v) => { if (!CUISINES.includes(v)) throw bad('Geçersiz mutfak türü.'); return v; }],
    city: ['city', (v) => str(v, 'city', { max: 60 })],
    address: ['address', (v) => String(v).slice(0, 300)],
    phone: ['phone', (v) => String(v).slice(0, 30)],
    lat: ['lat', (v) => num(v, 'lat', { min: -90, max: 90 })],
    lng: ['lng', (v) => num(v, 'lng', { min: -180, max: 180 })],
    price_level: ['priceLevel', (v) => num(v, 'priceLevel', { min: 1, max: 4 })],
    tags: ['tags', (v) => JSON.stringify((Array.isArray(v) ? v : []).filter((t) => TAGS[t])), '::jsonb'],
    specialties: ['specialties', (v) => JSON.stringify((Array.isArray(v) ? v : []).map(String).slice(0, 20)), '::jsonb'],
    opening_hours: ['openingHours', (v) => String(v).slice(0, 200)],
    accepts_reservations: ['acceptsReservations', (v) => !!v],
    contract_status: ['contractStatus', (v) => { if (!['pending', 'active', 'suspended'].includes(v)) throw bad('Geçersiz sözleşme durumu.'); return v; }],
    subscription_until: ['subscriptionUntil', (v) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw bad('Tarih YYYY-AA-GG olmalı.'); return v; }],
  };

  async function updateBusinessFields(conn, id, body, allowedFields) {
    const sets = [], params = [];
    for (const col of allowedFields) {
      const [key, conv, cast = ''] = FIELD_MAP[col];
      if (body[key] !== undefined) { sets.push(`${col} = ?${cast}`); params.push(conv(body[key])); }
    }
    if (sets.length) await conn.run(`UPDATE businesses SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
  }

  app.get('/api/admin/businesses', requireRole('admin'), h(async (_req, res) => {
    const rows = await db.all(`${BIZ_SELECT} ORDER BY b.city, b.name`);
    res.json(rows.map((r) => toBusiness(r, { includePrivate: true })));
  }));

  app.post('/api/admin/businesses', requireRole('admin'), h(async (req, res) => {
    const body = req.body;
    for (const k of ['name', 'cuisine', 'city', 'lat', 'lng', 'subscriptionUntil']) if (body[k] === undefined || body[k] === '') throw bad(`Zorunlu alan eksik: ${k}`);
    const row = {
      name: FIELD_MAP.name[1](body.name),
      cuisine: FIELD_MAP.cuisine[1](body.cuisine),
      city: FIELD_MAP.city[1](body.city),
      lat: FIELD_MAP.lat[1](body.lat),
      lng: FIELD_MAP.lng[1](body.lng),
      until: FIELD_MAP.subscription_until[1](body.subscriptionUntil),
    };
    const id = await db.tx(async (t) => {
      let ownerId = null;
      if (body.ownerEmail) {
        const email = String(body.ownerEmail).trim().toLowerCase();
        const existing = await t.get('SELECT id, role FROM users WHERE email = ?', email);
        if (existing) {
          ownerId = Number(existing.id);
          if (existing.role === 'user') await t.run("UPDATE users SET role = 'owner' WHERE id = ?", ownerId);
        } else {
          if (String(body.ownerPassword || '').length < 6) throw bad('Yeni işletme hesabı için en az 6 karakterlik şifre girin.');
          ownerId = await t.insert("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'owner')",
            str(body.ownerName || body.name, 'ownerName', { max: 80 }), email, hashPassword(String(body.ownerPassword)));
        }
      }
      const inspectedBy = body.inspectedBy ? String(body.inspectedBy).slice(0, 80) : null;
      const newId = await t.insert(
        `INSERT INTO businesses (name, cuisine, city, lat, lng, subscription_until, qr_code, owner_id, inspected_at, inspected_by)
         VALUES (?,?,?,?,?,?,?,?, CASE WHEN ?::text IS NULL THEN NULL ELSE current_date END, ?)`,
        row.name, row.cuisine, row.city, row.lat, row.lng, row.until, newQr(), ownerId, inspectedBy, inspectedBy);
      await updateBusinessFields(t, newId, body, ['description', 'address', 'phone', 'price_level', 'tags', 'specialties', 'opening_hours', 'accepts_reservations', 'contract_status']);
      return newId;
    });
    res.status(201).json(await adminBusiness(id));
  }));

  app.patch('/api/admin/businesses/:id', requireRole('admin'), h(async (req, res) => {
    const id = idParam(req.params.id);
    if (!(await db.get('SELECT 1 FROM businesses WHERE id = ?', id))) throw new HttpError(404, 'İşletme bulunamadı.');
    await updateBusinessFields(db, id, req.body, ['name', 'description', 'cuisine', 'city', 'address', 'phone', 'lat', 'lng', 'price_level', 'tags', 'specialties', 'opening_hours', 'accepts_reservations', 'contract_status', 'subscription_until']);
    if (req.body.inspectedBy) await db.run('UPDATE businesses SET inspected_at = current_date, inspected_by = ? WHERE id = ?', String(req.body.inspectedBy).slice(0, 80), id);
    res.json(await adminBusiness(id));
  }));

  app.post('/api/admin/businesses/:id/rotate-qr', requireRole('admin'), h(async (req, res) => {
    const id = idParam(req.params.id);
    if (!(await db.run('UPDATE businesses SET qr_code = ? WHERE id = ?', newQr(), id))) throw new HttpError(404, 'İşletme bulunamadı.');
    res.json(await adminBusiness(id));
  }));

  app.post('/api/admin/campaigns', requireRole('admin'), h(async (req, res) => {
    const b = req.body;
    if (!['isletme', 'belediye', 'uretici'].includes(b.sponsorType)) throw bad('sponsorType: isletme | belediye | uretici');
    const date = (v, n) => { const s = str(v, n, { max: 10 }); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw bad(`${n} YYYY-AA-GG olmalı.`); return s; };
    const id = await db.insert('INSERT INTO campaigns (sponsor_type, sponsor_name, title, body, city, business_id, starts_at, ends_at) VALUES (?,?,?,?,?,?,?,?)',
      b.sponsorType, str(b.sponsorName, 'sponsorName', { max: 120 }), str(b.title, 'title', { max: 120 }), String(b.body || '').slice(0, 1000),
      b.city || null, b.businessId ? idParam(b.businessId) : null, date(b.startsAt, 'startsAt'), date(b.endsAt, 'endsAt'));
    res.status(201).json({ id });
  }));

  app.get('/api/admin/stats', requireRole('admin'), h(async (_req, res) => {
    const one = async (sql) => Number(Object.values(await db.get(sql))[0]);
    res.json({
      users: await one("SELECT COUNT(*) FROM users WHERE role = 'user'"),
      activeBusinesses: await one(`SELECT COUNT(*) FROM businesses b WHERE ${ACTIVE}`),
      expiringIn30Days: await one(`SELECT COUNT(*) FROM businesses b WHERE ${ACTIVE} AND b.subscription_until <= current_date + 30`),
      ratings: await one('SELECT COUNT(*) FROM ratings'),
      visits: await one('SELECT COUNT(*) FROM visits'),
      pendingReservations: await one("SELECT COUNT(*) FROM reservations WHERE status = 'pending'"),
    });
  }));

  // ----- errors -----
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Bulunamadı.' }));
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Geçersiz JSON.' });
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
    if (err.code === '23505') return res.status(409).json({ error: 'Bu kayıt zaten mevcut.' });
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  });

  return app;
}
