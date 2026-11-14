import { CITIES, ROADS } from './roadnet.js';
import { haversineKm, decodePolyline, densify, cumulativeKm } from './geo.js';

const AVG_SPEED_KMH = 85;

/**
 * Returns a driving route between two points.
 * Order of preference: Google Directions (if GOOGLE_MAPS_API_KEY is set) → OSRM
 * (if OSRM_URL is set) → built-in road network → straight line.
 * @returns {{ points: number[][], distanceKm: number, durationMin: number, source: string }}
 */
export async function getRoute(from, to) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) {
    try { return await googleRoute(from, to, key); } catch (e) { console.warn('Google Directions hatası:', e.message); }
  }
  if (process.env.OSRM_URL) {
    try { return await osrmRoute(from, to, process.env.OSRM_URL); } catch (e) { console.warn('OSRM hatası:', e.message); }
  }
  return networkRoute(from, to);
}

async function googleRoute(from, to, key) {
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', from.join(','));
  url.searchParams.set('destination', to.join(','));
  url.searchParams.set('language', 'tr');
  url.searchParams.set('key', key);
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const body = await res.json();
  if (body.status !== 'OK') throw new Error(body.status);
  const route = body.routes[0];
  const legs = route.legs;
  return {
    points: densify(decodePolyline(route.overview_polyline.points), 2),
    distanceKm: legs.reduce((s, l) => s + l.distance.value, 0) / 1000,
    durationMin: legs.reduce((s, l) => s + l.duration.value, 0) / 60,
    source: 'google',
  };
}

async function osrmRoute(from, to, base) {
  const url = `${base.replace(/\/$/, '')}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const body = await res.json();
  if (body.code !== 'Ok') throw new Error(body.code);
  const r = body.routes[0];
  return {
    points: densify(r.geometry.coordinates.map(([lng, lat]) => [lat, lng]), 2),
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
    source: 'osrm',
  };
}

function nearestCity(p) {
  let best = null;
  for (const [name, c] of Object.entries(CITIES)) {
    const d = haversineKm(p, c);
    if (!best || d < best.d) best = { name, d };
  }
  return best;
}

/** Dijkstra over the built-in network, with straight-line access legs at both ends. */
export function networkRoute(from, to) {
  const a = nearestCity(from), b = nearestCity(to);
  let path = [from, to];
  if (a.name !== b.name && a.d < 60 && b.d < 60) {
    const cities = shortestPath(a.name, b.name);
    if (cities) path = [from, ...cities.map((n) => CITIES[n]), to];
  }
  const points = densify(path, 2);
  const distanceKm = cumulativeKm(points).at(-1);
  return { points, distanceKm, durationMin: (distanceKm / AVG_SPEED_KMH) * 60, source: path.length > 2 ? 'yerlesik-ag' : 'duz-cizgi' };
}

function shortestPath(start, goal) {
  const adj = {};
  for (const [x, y] of ROADS) {
    const w = haversineKm(CITIES[x], CITIES[y]);
    (adj[x] ||= []).push([y, w]);
    (adj[y] ||= []).push([x, w]);
  }
  const dist = { [start]: 0 }, prev = {}, done = new Set();
  while (true) {
    let u = null;
    for (const n of Object.keys(dist)) if (!done.has(n) && (u === null || dist[n] < dist[u])) u = n;
    if (u === null) return null;
    if (u === goal) break;
    done.add(u);
    for (const [v, w] of adj[u] || []) {
      if (dist[u] + w < (dist[v] ?? Infinity)) { dist[v] = dist[u] + w; prev[v] = u; }
    }
  }
  const out = [goal];
  while (out[0] !== start) out.unshift(prev[out[0]]);
  return out;
}
