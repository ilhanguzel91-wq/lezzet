/**
 * Google Places API (New) — real restaurants from Google Maps.
 *
 * Key: GOOGLE_PLACES_API_KEY (falls back to GOOGLE_MAPS_API_KEY). Enable "Places API (New)"
 * for it in Google Cloud.
 *
 * Google's terms: results are fetched live for each request and are not stored, except the
 * place ID (kept on contracted businesses as google_place_id). Wherever these results are
 * shown, the "Google Haritalar" attribution must be visible.
 */
import { encodePolyline, thin } from './geo.js';

const BASE = 'https://places.googleapis.com/v1';
const LIST_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount',
  'priceLevel', 'primaryTypeDisplayName', 'googleMapsUri', 'businessStatus',
];
const DETAIL_FIELDS = [...LIST_FIELDS, 'nationalPhoneNumber', 'regularOpeningHours.weekdayDescriptions'];

const PRICE = { PRICE_LEVEL_FREE: 1, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };

export class GoogleError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const apiKey = () => process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
export const googleConfigured = () => !!apiKey();

async function call(method, path, fields, body) {
  if (!googleConfigured()) throw new GoogleError(503, 'Google yer araması bu sunucuda henüz açık değil (API anahtarı tanımlı değil).');
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': apiKey(),
        'X-Goog-FieldMask': fields.join(','),
      },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new GoogleError(502, 'Google Haritalar şu an yanıt vermiyor, biraz sonra tekrar deneyin.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn('Google Places hatası:', res.status, data?.error?.message);
    if (res.status === 400 && /api key/i.test(data?.error?.message ?? '')) throw new GoogleError(502, 'Google anahtarı geçersiz. Sunucudaki GOOGLE_PLACES_API_KEY değerini kontrol edin.');
    if (res.status === 403) throw new GoogleError(502, 'Google anahtarı reddedildi. "Places API (New)" servisinin açık ve anahtarın kısıtlamalarının doğru olduğunu kontrol edin.');
    if (res.status === 429) throw new GoogleError(429, 'Google arama kotası doldu, biraz sonra tekrar deneyin.');
    throw new GoogleError(502, 'Google Haritalar araması başarısız oldu.');
  }
  return data;
}

function toPlace(p) {
  return {
    placeId: p.id,
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? '',
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    rating: p.rating ?? null,
    ratingCount: p.userRatingCount ?? 0,
    priceLevel: PRICE[p.priceLevel] ?? null,
    type: p.primaryTypeDisplayName?.text ?? '',
    mapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
    ...(p.nationalPhoneNumber !== undefined && { phone: p.nationalPhoneNumber }),
    ...(p.regularOpeningHours && { openingHours: (p.regularOpeningHours.weekdayDescriptions ?? []).join(' · ') }),
  };
}

const open = (p) => !p.businessStatus || p.businessStatus === 'OPERATIONAL';
const common = { languageCode: 'tr', regionCode: 'TR' };

/** Restaurants along a route polyline (Text Search "along route"). */
export async function placesAlongRoute(points, { query = 'restoran', max = 20 } = {}) {
  const data = await call('POST', '/places:searchText', LIST_FIELDS.map((f) => `places.${f}`), {
    ...common,
    textQuery: query,
    includedType: 'restaurant',
    maxResultCount: max,
    searchAlongRouteParameters: { polyline: { encodedPolyline: encodePolyline(thin(points, 300)) } },
  });
  return (data.places ?? []).filter(open).map(toPlace);
}

/** Restaurants around a point. */
export async function placesNearby(lat, lng, radiusKm, { max = 20 } = {}) {
  const data = await call('POST', '/places:searchNearby', LIST_FIELDS.map((f) => `places.${f}`), {
    ...common,
    includedTypes: ['restaurant'],
    maxResultCount: max,
    rankPreference: 'POPULARITY',
    locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radiusKm, 50) * 1000 } },
  });
  return (data.places ?? []).filter(open).map(toPlace);
}

/** Free-text search, e.g. "Afyon Kaymak Sofrası" — used by the field team. */
export async function searchPlaces(text, near) {
  const data = await call('POST', '/places:searchText', LIST_FIELDS.map((f) => `places.${f}`), {
    ...common,
    textQuery: text,
    maxResultCount: 10,
    ...(near && { locationBias: { circle: { center: { latitude: near[0], longitude: near[1] }, radius: 50000 } } }),
  });
  return (data.places ?? []).map(toPlace);
}

/** One place with phone and opening hours, to pre-fill the contract form. */
export async function placeDetails(placeId) {
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) throw new GoogleError(400, 'Geçersiz Google yer kimliği.');
  return toPlace(await call('GET', `/places/${placeId}`, DETAIL_FIELDS));
}

export const ATTRIBUTION = 'Google Haritalar';
