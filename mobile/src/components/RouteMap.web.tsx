import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { colors, radius } from '../lib/theme';
import { TURKEY_CENTER, type RouteMapProps } from './mapTypes';

/**
 * Browser preview map (Leaflet + OpenStreetMap). The phone app uses Google Maps (RouteMap.tsx).
 */
export function RouteMap({ height, line, pins, center, onPinPress }: RouteMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pressRef = useRef(onPinPress);
  useEffect(() => {
    pressRef.current = onPinPress;
  }, [onPinPress]);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true }).setView([TURKEY_CENTER.lat, TURKEY_CENTER.lng], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    if (line?.length) L.polyline(line, { color: colors.accent, weight: 4 }).addTo(g);
    for (const p of pins) {
      L.circleMarker([p.lat, p.lng], { radius: 7, color: '#fff', weight: 2, fillColor: p.color, fillOpacity: 1 })
        .bindTooltip(`<b>${escapeHtml(p.title)}</b>${p.subtitle ? `<br>${escapeHtml(p.subtitle)}` : ''}`)
        .on('click', () => pressRef.current?.(p.id))
        .addTo(g);
    }
    if (center && !line?.length) {
      m.setView([center.lat, center.lng], center.radiusKm <= 3 ? 14 : center.radiusKm <= 10 ? 12 : 10);
      L.circleMarker([center.lat, center.lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 })
        .bindTooltip('Konumunuz')
        .addTo(g);
    } else {
      const pts: [number, number][] = line?.length ? line : pins.map((p) => [p.lat, p.lng]);
      if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [24, 24] });
    }
  }, [line, pins, center]);

  return (
    <View style={{ height, borderRadius: radius, overflow: 'hidden', marginVertical: 12, borderWidth: 1, borderColor: colors.line }}>
      <div ref={el} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
