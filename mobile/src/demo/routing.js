// Copied from server/src/routing.js (offline network routing only) for the browser demo.
import { CITIES, ROADS } from './roadnet.js';
import { haversineKm, densify, cumulativeKm } from './geo.js';

const AVG_SPEED_KMH = 85;

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
