import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedDemo } from '../src/seed.js';
import { decodePolyline, locateOnPolyline } from '../src/geo.js';

let server, base, db;

before(async () => {
  delete process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.OSRM_URL;
  db = await openDb(':memory:');
  await seedDemo(db);
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server.close(); await db.close(); });

async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}
const login = async (email, password) => (await call('POST', '/auth/login', { email, password })).body.token;

test('geo: decodes Google polyline sample', () => {
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
  const loc = locateOnPolyline([0.01, 0.5], [[0, 0], [0, 1]]);
  assert.ok(Math.abs(loc.offRouteKm - 1.11) < 0.02);
  assert.ok(Math.abs(loc.alongKm - 55.6) < 0.5);
});

test('route İstanbul → Ankara follows the network and returns ordered stops', async () => {
  const { status, body } = await call('GET', '/route?fromCity=İstanbul&toCity=Ankara&corridorKm=8');
  assert.equal(status, 200);
  assert.equal(body.route.source, 'yerlesik-ag');
  assert.ok(body.route.distanceKm > 330 && body.route.distanceKm < 480, `distance ${body.route.distanceKm}`);
  const names = body.stops.map((s) => s.name);
  assert.ok(names.includes('Bolu Dağı Dinlenme Tesisi'));
  assert.ok(!names.includes('Antep Baklava Atölyesi'));
  const along = body.stops.map((s) => s.alongKm);
  assert.deepEqual(along, [...along].sort((a, b) => a - b));
  assert.ok(body.products.some((p) => p.name === 'Pişmaniye'));
});

test('route filters by tags and price', async () => {
  const { body } = await call('GET', '/route?fromCity=Ankara&toCity=Antalya&tags=vegan&corridorKm=10');
  assert.ok(body.stops.length > 0);
  assert.ok(body.stops.every((s) => s.tags.includes('vegan')));
  const cheap = await call('GET', '/route?fromCity=Ankara&toCity=Antalya&maxPrice=1');
  assert.ok(cheap.body.stops.every((s) => s.priceLevel <= 1));
  const badTag = await call('GET', '/route?fromCity=Ankara&toCity=Antalya&tags=yok');
  assert.equal(badTag.status, 400);
});

test('nearby search sorts by distance', async () => {
  const { body } = await call('GET', '/businesses?lat=39.93&lng=32.86&radiusKm=10');
  assert.ok(body.length >= 3);
  assert.ok(body.every((b) => b.city === 'Ankara'));
  assert.ok(body[0].distanceKm <= body.at(-1).distanceKm);
});

test('visit requires QR + physical presence, rating awards points once', async () => {
  const reg = await call('POST', '/auth/register', { name: 'Test Gezgin', email: 'gezgin@test.com', password: 'sifre123' });
  assert.equal(reg.status, 201);
  const token = reg.body.token;
  const biz = await db.get("SELECT id, lat, lng, qr_code FROM businesses WHERE name = 'Burdur Şiş Ustası'");

  assert.equal((await call('POST', '/visits', { qr: 'lezzetrotasi:' + biz.qr_code, lat: 39.9, lng: 32.8 }, token)).status, 422);
  assert.equal((await call('POST', '/visits', { qr: 'yanlis', lat: biz.lat, lng: biz.lng }, token)).status, 404);
  assert.equal((await call('POST', '/visits', { qr: biz.qr_code, lat: biz.lat, lng: biz.lng })).status, 401);

  const visit = await call('POST', '/visits', { qr: 'lezzetrotasi:' + biz.qr_code, lat: biz.lat + 0.001, lng: biz.lng }, token);
  assert.equal(visit.status, 201);

  const rating = await call('POST', '/ratings', { visitId: visit.body.visitId, score: 5, taste: 5, hygiene: 4, value: 5, comment: 'Şiş köfte harikaydı, servis de çok hızlıydı.' }, token);
  assert.equal(rating.status, 201);
  assert.equal(rating.body.points, 25); // 10 + 5 detailed + 10 new city
  assert.equal(rating.body.rewards.ratingCount, 1);
  assert.ok(rating.body.rewards.badges.find((b) => b.id === 'ilk-oy').earned);

  assert.equal((await call('POST', '/ratings', { visitId: visit.body.visitId, score: 1 }, token)).status, 409);

  const other = await login('kullanici@lezzetrotasi.local', 'demo123');
  assert.equal((await call('POST', '/ratings', { visitId: visit.body.visitId, score: 1 }, other)).status, 404);

  const detail = await call('GET', `/businesses/${biz.id}`);
  assert.equal(detail.body.ratings[0].userName, 'Test G.');
  assert.ok(!('qrCode' in detail.body), 'QR code must not leak publicly');
});

test('reservations: guest creates, owner confirms, guest cannot confirm', async () => {
  const guest = await login('kullanici@lezzetrotasi.local', 'demo123');
  const owner = await login('isletme@lezzetrotasi.local', 'demo123');
  const ownerBiz = (await call('GET', '/owner/businesses', null, owner)).body[0];
  const when = new Date(Date.now() + 2 * 864e5).toISOString();
  const r = await call('POST', '/reservations', { businessId: ownerBiz.id, reservedFor: when, partySize: 4, note: 'Bebek sandalyesi' }, guest);
  assert.equal(r.status, 201);
  assert.equal((await call('PATCH', `/reservations/${r.body.id}`, { status: 'confirmed' }, guest)).status, 403);
  const list = await call('GET', '/owner/reservations', null, owner);
  assert.equal(list.body.length, 1);
  const ok = await call('PATCH', `/reservations/${r.body.id}`, { status: 'confirmed' }, owner);
  assert.equal(ok.body.status, 'confirmed');
  assert.equal((await call('POST', '/reservations', { businessId: ownerBiz.id, reservedFor: '2000-01-01T10:00', partySize: 2 }, guest)).status, 400);
});

test('admin adds a business with owner account; expired subscription hides it', async () => {
  const admin = await login('admin@lezzetrotasi.local', 'admin123');
  const user = await login('kullanici@lezzetrotasi.local', 'demo123');
  assert.equal((await call('GET', '/admin/businesses', null, user)).status, 403);

  const created = await call('POST', '/admin/businesses', {
    name: 'Yeni Durak', cuisine: 'Kahvaltı', city: 'Eskişehir', lat: 39.78, lng: 30.52, subscriptionUntil: '2099-12-31',
    tags: ['vegan', 'uydurma'], ownerEmail: 'yeni@isletme.com', ownerPassword: 'gizli123', inspectedBy: 'Saha Ekibi A',
  }, admin);
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.tags, ['vegan']);
  assert.match(created.body.qrPayload, /^lezzetrotasi:/);
  assert.ok(await login('yeni@isletme.com', 'gizli123'));

  let near = await call('GET', '/businesses?lat=39.78&lng=30.52&radiusKm=1');
  assert.ok(near.body.some((b) => b.id === created.body.id));
  await call('PATCH', `/admin/businesses/${created.body.id}`, { subscriptionUntil: '2001-01-01' }, admin);
  near = await call('GET', '/businesses?lat=39.78&lng=30.52&radiusKm=1');
  assert.ok(!near.body.some((b) => b.id === created.body.id));

  const qr = await call('GET', `/businesses/${created.body.id}/qr`, null, admin);
  assert.match(qr.body.svg, /^<svg/);
  assert.equal((await call('GET', `/businesses/${created.body.id}/qr`, null, user)).status, 403);

  const stats = await call('GET', '/admin/stats', null, admin);
  assert.ok(stats.body.activeBusinesses >= 38);
});

test('auth rejects bad credentials and duplicate email', async () => {
  assert.equal((await call('POST', '/auth/login', { email: 'admin@lezzetrotasi.local', password: 'x' })).status, 401);
  assert.equal((await call('POST', '/auth/register', { name: 'A', email: 'admin@lezzetrotasi.local', password: '123456' })).status, 409);
  assert.equal((await call('GET', '/me', null, 'sahte.token')).status, 401);
});
