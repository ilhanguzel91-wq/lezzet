// Runs the same API flow against a real PostgreSQL server via the `pg` driver.
// Skipped unless TEST_DATABASE_URL is set, e.g.
//   TEST_DATABASE_URL=postgresql://lezzet:yerel@localhost/lezzet npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedDemo } from '../src/seed.js';

const url = process.env.TEST_DATABASE_URL;

test('pg driver: seed, route, visit + rating transaction', { skip: !url && 'TEST_DATABASE_URL yok' }, async () => {
  const db = await openDb(url);
  await seedDemo(db);
  const server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, path, body, token) => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  try {
    const route = await call('GET', '/route?fromCity=Ankara&toCity=Antalya');
    assert.ok(route.body.stops.length > 0);
    const { token } = (await call('POST', '/auth/login', { email: 'kullanici@lezzetrotasi.local', password: 'demo123' })).body;
    const biz = await db.get("SELECT id, lat, lng, qr_code, subscription_until FROM businesses WHERE name = 'Burdur Şiş Ustası'");
    assert.match(biz.subscription_until, /^\d{4}-\d{2}-\d{2}$/);
    const visit = await call('POST', '/visits', { qr: biz.qr_code, lat: biz.lat, lng: biz.lng }, token);
    assert.equal(visit.status, 201);
    const rating = await call('POST', '/ratings', { visitId: visit.body.visitId, score: 4, comment: 'Gerçek PostgreSQL üzerinde deneme yorumu.' }, token);
    assert.equal(rating.status, 201);
    assert.equal(rating.body.points, 25);
    const admin = (await call('POST', '/auth/login', { email: 'admin@lezzetrotasi.local', password: 'admin123' })).body.token;
    const bad = await call('POST', '/admin/businesses', { name: 'X', cuisine: 'Kahvaltı', city: 'Bolu', lat: 40, lng: 31, subscriptionUntil: '2099-01-01', ownerEmail: 'yeni@x.com' }, admin);
    assert.equal(bad.status, 400);
    assert.equal(await db.get("SELECT 1 FROM businesses WHERE name = 'X'"), undefined, 'transaction rolled back');
  } finally {
    server.close();
    await db.close();
  }
});
