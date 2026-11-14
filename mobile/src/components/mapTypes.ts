export type MapPin = { id: number; lat: number; lng: number; title: string; subtitle?: string; color: string };

export type RouteMapProps = {
  height: number;
  /** Route polyline as [lat, lng] pairs. */
  line?: [number, number][];
  pins: MapPin[];
  /** When set (and no line), the map centres here, showing roughly radiusKm around it. */
  center?: { lat: number; lng: number; radiusKm: number };
  onPinPress?: (id: number) => void;
};

export const TURKEY_CENTER = { lat: 39.0, lng: 35.0 };
