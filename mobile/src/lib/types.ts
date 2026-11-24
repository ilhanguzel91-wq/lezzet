export type Tag = { id: string; label: string };
export type City = { name: string; lat: number; lng: number };
export type Meta = { cities: City[]; cuisines: string[]; tags: Tag[]; priceLevels: { level: number; label: string }[] };

export type RatingSummary = {
  count: number;
  average: number | null;
  taste: number | null;
  hygiene: number | null;
  value: number | null;
  trustScore: number;
};

export type Business = {
  id: number;
  name: string;
  description: string;
  cuisine: string;
  city: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  priceLevel: number;
  tags: string[];
  specialties: string[];
  openingHours: string;
  acceptsReservations: boolean;
  inspected: boolean;
  inspectedAt: string | null;
  rating: RatingSummary;
  distanceKm?: number;
  offRouteKm?: number;
  alongKm?: number;
};

export type Review = {
  id: number;
  score: number;
  taste: number | null;
  hygiene: number | null;
  value: number | null;
  comment: string;
  createdAt: string;
  userName: string;
};

export type Product = { id: number; name: string; city: string; description: string; lat: number; lng: number; alongKm?: number };

export type BusinessDetail = Business & { ratings: Review[]; products: Product[] };

export type Campaign = {
  id: number;
  sponsorType: 'isletme' | 'belediye' | 'uretici';
  sponsorName: string;
  title: string;
  body: string;
  city: string | null;
  businessId: number | null;
  sponsored: true;
};

export type RouteResult = {
  route: { points: [number, number][]; distanceKm: number; durationMin: number; source: string };
  corridorKm: number;
  stops: Business[];
  products: Product[];
  campaigns: Campaign[];
};

export type Prefs = { tags?: string[]; cuisines?: string[]; maxPrice?: number | null };
export type User = { id: number; name: string; email: string; role: 'user' | 'owner' | 'admin'; prefs: Prefs };

export type Rewards = {
  points: number;
  level: string;
  nextLevel: string | null;
  pointsToNext: number;
  ratingCount: number;
  cityCount: number;
  drawEntries: number;
  ratingsToNextEntry: number;
  badges: { id: string; name: string; earned: boolean }[];
};

export type Visit = {
  id: number;
  createdAt: string;
  businessId: number;
  businessName: string;
  city: string;
  ratedScore: number | null;
  canRate: boolean;
};

export type Reservation = {
  id: number;
  businessId: number;
  businessName: string;
  userId: number;
  userName: string;
  reservedFor: string;
  partySize: number;
  note: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  createdAt: string;
};

export type Filters = { tags: string[]; cuisines: string[]; maxPrice: number | null; minRating: number | null };
export const emptyFilters: Filters = { tags: [], cuisines: [], maxPrice: null, minRating: null };

/** A restaurant from Google Maps (live result, not a contracted stop). */
export type GooglePlace = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  ratingCount: number;
  priceLevel: number | null;
  type: string;
  mapsUrl: string;
  alongKm?: number;
  offRouteKm?: number;
  distanceKm?: number;
};
