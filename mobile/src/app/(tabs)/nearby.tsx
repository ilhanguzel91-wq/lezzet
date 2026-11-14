import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { router } from 'expo-router';
import { api, filterQuery } from '../../lib/api';
import { currentPosition, type Coords } from '../../lib/location';
import { useMeta } from '../../lib/meta';
import { colors, radius } from '../../lib/theme';
import { emptyFilters, type Business, type Filters } from '../../lib/types';
import { BusinessCard } from '../../components/BusinessCard';
import { FilterBar } from '../../components/FilterBar';
import { Button, Chip, Empty, ErrorText } from '../../components/ui';

/**
 * Phase 2: people who live in a city discover new places and book a table.
 */
export default function NearbyScreen() {
  const meta = useMeta();
  const [pos, setPos] = useState<Coords | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [onlyReservable, setOnlyReservable] = useState(false);
  const [items, setItems] = useState<Business[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: Coords | null = pos, f = filters, r = radiusKm, reservable = onlyReservable) => {
      setLoading(true);
      setError(null);
      try {
        const here = p ?? (await currentPosition());
        setPos(here);
        const q = new URLSearchParams(filterQuery(f));
        q.set('lat', String(here.lat));
        q.set('lng', String(here.lng));
        q.set('radiusKm', String(r));
        if (reservable) q.set('reservations', '1');
        setItems(await api<Business[]>(`/businesses?${q}`));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [pos, filters, radiusKm, onlyReservable],
  );

  // Initial load: state is only set from async callbacks, never synchronously in the effect.
  useEffect(() => {
    currentPosition()
      .then((p) => load(p))
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={items ?? []}
      keyExtractor={(b) => String(b.id)}
      onRefresh={() => load(null)}
      refreshing={loading}
      ListHeaderComponent={
        <View>
          <View style={styles.row}>
            <Text style={styles.small}>Mesafe:</Text>
            {[3, 10, 25].map((km) => (
              <Chip key={km} label={`${km} km`} active={radiusKm === km} onPress={() => { setRadiusKm(km); load(pos, filters, km); }} />
            ))}
            <Chip
              label="Rezervasyon alanlar"
              active={onlyReservable}
              onPress={() => { setOnlyReservable(!onlyReservable); load(pos, filters, radiusKm, !onlyReservable); }}
            />
          </View>
          <FilterBar meta={meta} value={filters} onChange={(f) => { setFilters(f); load(pos, f); }} />
          <ErrorText text={error} />
          {error && <Button title="Tekrar dene" onPress={() => load(null)} variant="ghost" />}
          {pos && (
            <View style={styles.mapWrap}>
              <MapView
                style={StyleSheet.absoluteFill}
                provider={PROVIDER_GOOGLE}
                showsUserLocation
                region={{ latitude: pos.lat, longitude: pos.lng, latitudeDelta: radiusKm / 50, longitudeDelta: radiusKm / 50 }}
              >
                {items?.map((b) => (
                  <Marker
                    key={b.id}
                    coordinate={{ latitude: b.lat, longitude: b.lng }}
                    title={b.name}
                    description={b.cuisine}
                    pinColor={colors.accent}
                    onCalloutPress={() => router.push(`/business/${b.id}`)}
                  />
                ))}
              </MapView>
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => <BusinessCard b={item} meta={meta} mode="nearby" />}
      ListEmptyComponent={items && !loading ? <Empty text="Yakınınızda bu filtrelere uyan anlaşmalı işletme yok." /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  small: { color: colors.muted, fontSize: 13, marginRight: 6 },
  mapWrap: { height: 220, borderRadius: radius, overflow: 'hidden', marginVertical: 12, borderWidth: 1, borderColor: colors.line },
});
