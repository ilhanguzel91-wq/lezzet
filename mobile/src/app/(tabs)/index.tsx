import { useMemo, useRef, useState } from 'react';
import { FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { router } from 'expo-router';
import { api, filterQuery } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { currentPosition } from '../../lib/location';
import { useMeta } from '../../lib/meta';
import { colors, radius } from '../../lib/theme';
import { emptyFilters, type Filters, type RouteResult } from '../../lib/types';
import { BusinessCard } from '../../components/BusinessCard';
import { CityPicker, MY_LOCATION } from '../../components/CityPicker';
import { FilterBar } from '../../components/FilterBar';
import { Badge, Button, Card, Chip, Empty, ErrorText, SectionTitle } from '../../components/ui';

const TURKEY = { latitude: 39.0, longitude: 35.0, latitudeDelta: 9, longitudeDelta: 14 };

export default function RouteScreen() {
  const meta = useMeta();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);
  const [from, setFrom] = useState<string | null>(MY_LOCATION);
  const [to, setTo] = useState<string | null>(null);
  const [corridor, setCorridor] = useState(10);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the user's saved preferences (diet, budget, cuisine) once per signed-in user.
  const [prefsAppliedFor, setPrefsAppliedFor] = useState<number | null>(null);
  if (user && user.id !== prefsAppliedFor) {
    setPrefsAppliedFor(user.id);
    setFilters({
      ...emptyFilters,
      tags: user.prefs.tags ?? [],
      cuisines: user.prefs.cuisines ?? [],
      maxPrice: user.prefs.maxPrice ?? null,
    });
  }

  async function search(f = filters) {
    if (!from || !to) return setError('Başlangıç ve varış noktasını seçin.');
    setError(null);
    setLoading(true);
    try {
      const p = new URLSearchParams(filterQuery(f));
      if (from === MY_LOCATION) {
        const c = await currentPosition();
        p.set('from', `${c.lat},${c.lng}`);
      } else p.set('fromCity', from);
      p.set('toCity', to);
      p.set('corridorKm', String(corridor));
      const r = await api<RouteResult>(`/route?${p}`);
      setResult(r);
      const coords = r.route.points.map(([latitude, longitude]) => ({ latitude, longitude }));
      setTimeout(() => mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 30, right: 30, bottom: 30, left: 30 }, animated: true }), 300);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const line = useMemo(() => result?.route.points.map(([latitude, longitude]) => ({ latitude, longitude })) ?? [], [result]);
  const hours = result ? Math.floor(result.route.durationMin / 60) : 0;
  const mins = result ? result.route.durationMin % 60 : 0;

  const header = (
    <View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <CityPicker label="Nereden" value={from} cities={meta?.cities ?? []} allowMyLocation onChange={setFrom} />
        <CityPicker label="Nereye" value={to} cities={meta?.cities ?? []} onChange={setTo} />
      </View>
      <View style={styles.corridorRow}>
        <Text style={styles.small}>Yoldan sapma:</Text>
        {[5, 10, 20].map((km) => (
          <Chip key={km} label={`${km} km`} active={corridor === km} onPress={() => setCorridor(km)} />
        ))}
      </View>
      <FilterBar
        meta={meta}
        value={filters}
        onChange={(f) => {
          setFilters(f);
          if (result) search(f);
        }}
      />
      <Button title="Lezzet duraklarını bul" onPress={() => search()} loading={loading} style={{ marginTop: 6 }} />
      <ErrorText text={error} />

      <View style={styles.mapWrap}>
        <MapView ref={mapRef} style={StyleSheet.absoluteFill} provider={PROVIDER_GOOGLE} initialRegion={TURKEY} showsUserLocation>
          {line.length > 0 && <Polyline coordinates={line} strokeColor={colors.accent} strokeWidth={4} />}
          {result?.stops.map((b) => (
            <Marker
              key={b.id}
              coordinate={{ latitude: b.lat, longitude: b.lng }}
              title={b.name}
              description={`${b.cuisine} · ${b.rating.average ?? '–'}★`}
              pinColor={b.inspected ? colors.ok : colors.accent}
              onCalloutPress={() => router.push(`/business/${b.id}`)}
            />
          ))}
        </MapView>
      </View>

      {result && (
        <Card>
          <Text style={styles.summary}>
            {result.route.distanceKm} km · yaklaşık {hours > 0 ? `${hours} sa ` : ''}
            {mins} dk
          </Text>
          <Text style={styles.small}>
            Güzergâhta {result.stops.length} lezzet durağı · {result.products.length} yöresel ürün
          </Text>
          {result.route.source !== 'google' && (
            <Text style={[styles.small, { marginTop: 4 }]}>
              Not: Rota yaklaşık olarak hesaplandı. Navigasyon için durağa dokunup “Yol tarifi al” düğmesini kullanın.
            </Text>
          )}
          {to && (
            <Button
              title="Tüm rotayı Google Haritalar'da aç"
              variant="ghost"
              style={{ marginTop: 10 }}
              onPress={() => {
                const dest = meta?.cities.find((c) => c.name === to);
                if (dest) Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`);
              }}
            />
          )}
        </Card>
      )}

      {result?.campaigns.map((c) => (
        <Card key={c.id} style={{ backgroundColor: colors.warnSoft, borderColor: colors.warnSoft }}>
          <Badge label={`Sponsorlu · ${c.sponsorName}`} tone="warn" />
          <Text style={[styles.summary, { marginTop: 6 }]}>{c.title}</Text>
          {!!c.body && <Text style={styles.small}>{c.body}</Text>}
        </Card>
      ))}

      {result && <SectionTitle>Rota üzerindeki duraklar</SectionTitle>}
    </View>
  );

  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={result?.stops ?? []}
      keyExtractor={(b) => String(b.id)}
      ListHeaderComponent={header}
      renderItem={({ item }) => <BusinessCard b={item} meta={meta} mode="route" />}
      ListEmptyComponent={result ? <Empty text="Bu filtrelerle güzergâhta durak bulunamadı. Filtreleri gevşetmeyi ya da sapma mesafesini artırmayı deneyin." /> : undefined}
      ListFooterComponent={
        result && result.products.length > 0 ? (
          <View>
            <SectionTitle>Yol üstündeki yöresel ürünler</SectionTitle>
            {result.products.map((p) => (
              <Card key={p.id}>
                <Text style={styles.summary}>{p.name}</Text>
                <Text style={styles.small}>
                  {p.city} · {p.alongKm} km sonra
                </Text>
                {!!p.description && <Text style={{ marginTop: 4, color: colors.ink }}>{p.description}</Text>}
              </Card>
            ))}
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  corridorRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 10, gap: 4 },
  small: { color: colors.muted, fontSize: 13, marginRight: 6 },
  mapWrap: { height: 260, borderRadius: radius, overflow: 'hidden', marginVertical: 12, borderWidth: 1, borderColor: colors.line },
  summary: { fontSize: 16, fontWeight: '700', color: colors.ink },
});
