const R = 6371; // km
const rad = (d) => (d * Math.PI) / 180;

export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Distance from point p to segment a-b in km, plus the fraction t (0..1) of the
 * projection along the segment. Uses a local equirectangular projection, which is
 * accurate enough at the scale of a road corridor (a few km).
 */
function pointSegment(p, a, b) {
  const k = Math.cos(rad((a[0] + b[0]) / 2));
  const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = p[1] * k, py = p[0];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const proj = [ay + t * dy, (ax + t * dx) / k];
  return { km: haversineKm(p, proj), t };
}

/**
 * Locates point p relative to a polyline.
 * Returns { offRouteKm, alongKm } — how far from the road and how far from the start.
 */
export function locateOnPolyline(p, line, cumulative = cumulativeKm(line)) {
  let best = { offRouteKm: Infinity, alongKm: 0 };
  for (let i = 0; i < line.length - 1; i++) {
    const { km, t } = pointSegment(p, line[i], line[i + 1]);
    if (km < best.offRouteKm) {
      best = { offRouteKm: km, alongKm: cumulative[i] + t * (cumulative[i + 1] - cumulative[i]) };
    }
  }
  if (line.length === 1) best = { offRouteKm: haversineKm(p, line[0]), alongKm: 0 };
  return best;
}

export function cumulativeKm(line) {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + haversineKm(line[i - 1], line[i]));
  return out;
}

export function boundingBox(line, padKm) {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const [la, ln] of line) {
    minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la);
    minLng = Math.min(minLng, ln); maxLng = Math.max(maxLng, ln);
  }
  const dLat = padKm / 111;
  const dLng = padKm / (111 * Math.cos(rad((minLat + maxLat) / 2)));
  return { minLat: minLat - dLat, maxLat: maxLat + dLat, minLng: minLng - dLng, maxLng: maxLng + dLng };
}

/** Inserts intermediate points so no segment is longer than stepKm. */
export function densify(line, stepKm = 2) {
  const out = [line[0]];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const n = Math.max(1, Math.ceil(haversineKm(a, b) / stepKm));
    for (let j = 1; j <= n; j++) out.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
  }
  return out;
}

/** Reduces point count for transfer to the client (keeps every n-th point + last). */
export function thin(line, maxPoints = 400) {
  if (line.length <= maxPoints) return line;
  const step = Math.ceil(line.length / maxPoints);
  const out = line.filter((_, i) => i % step === 0);
  if (out[out.length - 1] !== line[line.length - 1]) out.push(line[line.length - 1]);
  return out;
}

/** Decodes a Google encoded polyline into [[lat, lng], ...]. */
export function decodePolyline(str) {
  const out = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, byte;
      do {
        byte = str.charCodeAt(i++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta; else lng += delta;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}
