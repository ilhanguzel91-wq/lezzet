// Google Places endpoints, with Google's API replaced by a local fake.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedDemo } from '../src/seed.js';
import { decodePolyline } from '../src/geo.js';

let server, base, db;
const realFetch = globalThis.fetch;
const googleCalls = [];

// Ulus Tava Evi is a contracted demo business; the fake also returns it, plus two other places.
let ulus;
const fakePlaces = () => [
  { id: 'ChIJ-gercek-lokanta-1', displayName: { text: 'Yol Üstü Köfteci' }, formattedAddress: 'Bolu', location: { latitude: 40.74, longitude: 31.6 }, rating: 4.4, userRatingCount: 812, priceLevel: 'PRICE_LEVEL_INEXPENSIVE', primaryTypeDisplayName: { text: 'Restoran' }, googleMapsUri: 'https://maps.google.com/?cid=1', businessStatus: 'OPERATIONAL' },
  { id: 'ChIJ-kapanmis-yer-22', displayName: { text: 'Kapanmış Lokanta' }, location: { latitude: 40.0, longitude: 32.0 }, businessStatus: 'CLOSED_PERMANENTLY' },
  { id: 'ChIJ-ulus-tava-google', displayName: { text: ulus.name }, location: { latitude: ulus.lat + 0.0005, longitude: ulus.lng }, rating: 4.1, userRatingCount: 50 },
];

before(async () => {
  process.env.GOOGLE_PLACES_API_KEY = 'test-anahtari';
  delete process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.OSRM_URL;
  db = await openDb(':memory:');
  await seedDemo(db);
  ulus = await db.get("SELECT name, lat, lng FROM businesses WHERE name = 'Ulus Tava Evi'");
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith('https://places.googleapis.com/')) {
      googleCalls.push({ url: String(url), headers: opts.headers, body: opts.body ? JSON.parse(opts.body) : null });
      const place = /\/v1\/places\/[^:/]+$/.test(String(url));
      const body = place
        ? { ...fakePlaces()[0], nationalPhoneNumber: '0374 000 00 00', regularOpeningHours: { weekdayDescriptions: ['Pazartesi: 08:00–22:00'] } }
        : { places: fakePlaces() };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, opts);
  };
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  globalThis.fetch = realFetch;
  delete process.env.GOOGLE_PLACES_API_KEY;
  server.close();
  await db.close();
});

const get = async (path, token) => {
  const res = await realFetch(base + path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: res.status, body: await res.json() };
};

test('route places: searches along the route, hides closed and contracted places', async () => {
  const { status, body } = await get('/google/route-places?fromCity=İstanbul&toCity=Ankara');
  assert.equal(status, 200);
  assert.equal(body.attribution, 'Google Haritalar');
  assert.deepEqual(body.places.map((p) => p.name), ['Yol Üstü Köfteci']);
  const [p] = body.places;
  assert.equal(p.priceLevel, 1);
  assert.equal(p.ratingCount, 812);
  assert.ok(p.alongKm > 200 && p.offRouteKm < 5, `along ${p.alongKm}, off ${p.offRouteKm}`);

  const call = googleCalls.at(-1);
  assert.equal(call.headers['X-Goog-Api-Key'], 'test-anahtari');
  assert.match(call.headers['X-Goog-FieldMask'], /places\.rating/);
  assert.equal(call.body.includedType, 'restaurant');
  const line = decodePolyline(call.body.searchAlongRouteParameters.polyline.encodedPolyline);
  assert.ok(line.length > 10 && line.length <= 301);
  assert.ok(Math.abs(line[0][0] - 41.0082) < 0.01, 'polyline starts in İstanbul');
});

test('nearby places: radius sent to Google, results carry distance', async () => {
  const { body } = await get('/google/nearby-places?lat=40.735&lng=31.606&radiusKm=5');
  assert.equal(googleCalls.at(-1).body.locationRestriction.circle.radius, 5000);
  assert.equal(body.places[0].name, 'Yol Üstü Köfteci');
  assert.ok(body.places[0].distanceKm < 2);
});

test('field team search and details are admin-only; place ID is saved on the business', async () => {
  const login = async (email, password) =>
    (await (await realFetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
  const user = await login('kullanici@lezzetrotasi.local', 'demo123');
  const admin = await login('admin@lezzetrotasi.local', 'admin123');
  assert.equal((await get('/admin/google/search?q=köfte', user)).status, 403);

  const search = await get('/admin/google/search?q=köfte&city=Bolu', admin);
  assert.equal(search.status, 200);
  assert.ok(googleCalls.at(-1).body.locationBias.circle);

  const detail = await get('/admin/google/place/ChIJ-gercek-lokanta-1', admin);
  assert.equal(detail.body.place.phone, '0374 000 00 00');
  assert.match(detail.body.place.openingHours, /Pazartesi/);
  assert.equal((await get('/admin/google/place/..%2F..%2Fetc', admin)).status, 400);

  const created = await realFetch(base + '/admin/businesses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${admin}` },
    body: JSON.stringify({ name: 'Yol Üstü Köfteci', cuisine: 'Kebap & Izgara', city: 'Bolu', lat: 40.74, lng: 31.6, subscriptionUntil: '2099-01-01', googlePlaceId: 'ChIJ-gercek-lokanta-1' }),
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).googlePlaceId, 'ChIJ-gercek-lokanta-1');
  // Now contracted, so Google results no longer list it separately.
  const again = await get('/google/nearby-places?lat=40.735&lng=31.606&radiusKm=5');
  assert.equal(again.body.places.length, 0);
});

test('without a key the endpoints say Google search is off', async () => {
  delete process.env.GOOGLE_PLACES_API_KEY;
  try {
    const { status, body } = await get('/google/nearby-places?lat=40&lng=32');
    assert.equal(status, 503);
    assert.match(body.error, /anahtar/);
    assert.equal((await get('/google/status')).body.enabled, false);
  } finally {
    process.env.GOOGLE_PLACES_API_KEY = 'test-anahtari';
  }
});
