import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors, radius } from '../lib/theme';
import { TURKEY_CENTER, type RouteMapProps } from './mapTypes';

// Google Maps everywhere, except on iPhone inside the Expo Go app (no Google Maps SDK there):
// that preview uses Apple Maps. Real builds (EAS) always use Google Maps.
const inExpoGoOnIos = Platform.OS === 'ios' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const provider = inExpoGoOnIos ? undefined : PROVIDER_GOOGLE;

/** Native map (Google Maps on iOS and Android). The browser version is RouteMap.web.tsx. */
export function RouteMap({ height, line, pins, center, onPinPress }: RouteMapProps) {
  const ref = useRef<MapView>(null);

  useEffect(() => {
    const coords = (line?.length ? line : pins.map((p) => [p.lat, p.lng] as [number, number])).map(([latitude, longitude]) => ({ latitude, longitude }));
    if (center && !line?.length) return;
    if (coords.length > 1) {
      const t = setTimeout(() => ref.current?.fitToCoordinates(coords, { edgePadding: { top: 30, right: 30, bottom: 30, left: 30 }, animated: true }), 300);
      return () => clearTimeout(t);
    }
  }, [line, pins, center]);

  const region = center
    ? { latitude: center.lat, longitude: center.lng, latitudeDelta: center.radiusKm / 50, longitudeDelta: center.radiusKm / 50 }
    : undefined;

  return (
    <View style={[s.wrap, { height }]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        provider={provider}
        showsUserLocation
        initialRegion={{ latitude: TURKEY_CENTER.lat, longitude: TURKEY_CENTER.lng, latitudeDelta: 9, longitudeDelta: 14 }}
        region={region}
      >
        {!!line?.length && (
          <Polyline coordinates={line.map(([latitude, longitude]) => ({ latitude, longitude }))} strokeColor={colors.accent} strokeWidth={4} />
        )}
        {pins.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={p.title}
            description={p.subtitle}
            pinColor={p.color}
            onCalloutPress={() => onPinPress?.(p.id)}
          />
        ))}
      </MapView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: radius, overflow: 'hidden', marginVertical: 12, borderWidth: 1, borderColor: colors.line },
});
