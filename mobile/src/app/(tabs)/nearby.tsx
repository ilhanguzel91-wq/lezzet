import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, filterQuery } from '../../lib/api';
import { currentPosition, type Coords } from '../../lib/location';
import { distanceKm } from '../../lib/geo';
import { useMeta } from '../../lib/meta';
import { colors } from '../../lib/theme';
import { emptyFilters, type Business, type Filters } from '../../lib/types';
import { BusinessCard } from '../../components/BusinessCard';
import { RouteMap } from '../../components/RouteMap';
import { FilterBar } from '../../components/FilterBar';
import { GooglePlaces } from '../../components/GooglePlaces';
import { Button, Chip, Empty, ErrorText } from '../../components/ui';

/**
 * Phase 2: people who live in a city discover new places and book a table.
 */
export default function NearbyScreen() {
  const meta = useMeta();
  const params = useLocalSearchParams<{ cuisine?: string }>();
  const [pos, setPos] = useState<Coords | null>(null);
  const [radiusKm, setRadiusKm] = useState(params.cuisine ? 25 : 10);
  const [filters, setFilters] = useState<Filters>(params.cuisine ? { ...emptyFilters, cuisines: [params.cuisine] } : emptyFilters);
  // A category picked on the home page while this tab is already open.
  const [appliedCuisine, setAppliedCuisine] = useState(params.cuisine ?? '');
  const [pendingReload, setPendingReload] = useState(false);
  if (params.cuisine && params.cuisine !== appliedCuisine) {
    setAppliedCuisine(params.cuisine);
    setFilters({ ...emptyFilters, cuisines: [params.cuisine] });
    setRadiusKm(25);
    setPendingReload(true);
  }
  const [onlyReservable, setOnlyReservable] = useState(false);
  const [items, setItems] = useState<Business[] | null>(null);
  // True when nothing matched nearby and the list shows the best matches across Turkey.
  const [nationwide, setNationwide] = useState(false);
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
        let found = await api<Business[]>(`/businesses?${q}`);
        const wide = found.length === 0 && f.cuisines.length > 0;
        if (wide) {
          const all = await api<Business[]>(`/businesses?${filterQuery(f)}`);
          found = all.slice(0, 15).map((b) => ({ ...b, distanceKm: Math.round(distanceKm(here, b)) }));
        }
        setNationwide(wide);
        setItems(found);
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

  useEffect(() => {
    if (!pendingReload) return;
    Promise.resolve().then(() => {
      setPendingReload(false);
      load(pos);
    });
  }, [pendingReload]); // eslint-disable-line react-hooks/exhaustive-deps

  const pins = useMemo(
    () => (items ?? []).map((b) => ({ id: b.id, lat: b.lat, lng: b.lng, title: b.name, subtitle: b.cuisine, color: colors.accent })),
    [items],
  );

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
          {nationwide && (
            <Text style={styles.notice}>
              {radiusKm} km içinde {filters.cuisines.join(', ')} durağı yok. Türkiye genelinde en sevilenler:
            </Text>
          )}
          {pos && !nationwide && (
            <RouteMap
              height={220}
              pins={pins}
              center={{ lat: pos.lat, lng: pos.lng, radiusKm }}
              onPinPress={(id) => router.push(`/business/${id}`)}
            />
          )}
        </View>
      }
      renderItem={({ item }) => <BusinessCard b={item} meta={meta} mode="nearby" />}
      ListFooterComponent={
        pos ? (
          <GooglePlaces
            key={`${pos.lat},${pos.lng},${radiusKm}`}
            path={`/google/nearby-places?lat=${pos.lat}&lng=${pos.lng}&radiusKm=${Math.min(radiusKm, 50)}`}
            mode="nearby"
          />
        ) : undefined
      }
      ListEmptyComponent={items && !loading ? <Empty text="Yakınınızda bu filtrelere uyan anlaşmalı işletme yok." /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  small: { color: colors.muted, fontSize: 13, marginRight: 6 },
  notice: { color: colors.ink, fontSize: 14, lineHeight: 20, backgroundColor: colors.saffronSoft, borderRadius: 10, padding: 12, marginVertical: 10 },
});
