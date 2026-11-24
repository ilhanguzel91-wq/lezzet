import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, DEMO } from '../lib/api';
import { priceLabel } from '../lib/meta';
import { colors, fonts, radius } from '../lib/theme';
import type { GooglePlace } from '../lib/types';
import { Badge, Button, ErrorText } from './ui';

let enabledCache: boolean | null = null;

/**
 * Other restaurants from Google Maps, listed apart from contracted stops.
 * Loaded only on request (each Google search is billed). `path` is the API call to make;
 * give the component a `key` that changes with the search so old results are cleared.
 */
export function GooglePlaces({ path, mode }: { path: string; mode: 'route' | 'nearby' }) {
  const [enabled, setEnabled] = useState<boolean | null>(DEMO ? false : enabledCache);
  const [places, setPlaces] = useState<GooglePlace[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (DEMO || enabledCache !== null) return;
    api<{ enabled: boolean }>('/google/status')
      .then((r) => {
        enabledCache = r.enabled;
        setEnabled(r.enabled);
      })
      .catch(() => setEnabled(false));
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPlaces((await api<{ places: GooglePlace[] }>(path)).places);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (DEMO) {
    return (
      <View style={s.box}>
        <Text style={s.title}>Google Haritalar’daki diğer yerler</Text>
        <Text style={s.muted}>
          Gerçek uygulamada burada, anlaşmalı duraklarımızın yanında Google Haritalar’daki diğer lokantalar da listelenir. Tanıtım sürümünde bu arama kapalıdır.
        </Text>
      </View>
    );
  }
  if (!enabled) return null;

  return (
    <View style={s.box}>
      <Text style={s.title}>Google Haritalar’daki diğer yerler</Text>
      <Text style={s.muted}>
        Anlaşmalı olmayan, denetlenmemiş işletmeler. Puanlar Google kullanıcılarına aittir ve sıralamamıza katılmaz.
      </Text>
      {places === null ? (
        <Button title="Google’dan getir" variant="ghost" onPress={load} loading={loading} style={{ marginTop: 10 }} />
      ) : places.length === 0 ? (
        <Text style={[s.muted, { marginTop: 10 }]}>Google Haritalar’da başka lokanta bulunamadı.</Text>
      ) : (
        <View style={{ marginTop: 10 }}>
          {places.map((p, i) => (
            <Pressable
              key={p.placeId}
              onPress={() => Linking.openURL(p.mapsUrl)}
              style={({ pressed }) => [s.row, i > 0 && s.rule, pressed && { opacity: 0.7 }]}
              accessibilityRole="link"
              accessibilityLabel={`${p.name}, Google Haritalar'da aç`}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={s.muted} numberOfLines={1}>
                  {[p.type, p.priceLevel ? priceLabel(p.priceLevel) : null].filter(Boolean).join(' · ')}
                </Text>
                <Text style={s.muted}>
                  {mode === 'route' ? `${p.alongKm} km sonra · yoldan ${p.offRouteKm} km` : `${p.distanceKm} km uzaklıkta`}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {p.rating != null && (
                  <Text style={s.rating}>
                    ★ {p.rating.toFixed(1)} <Text style={s.muted}>({p.ratingCount})</Text>
                  </Text>
                )}
                <Badge label="Anlaşmalı değil" />
              </View>
            </Pressable>
          ))}
        </View>
      )}
      <ErrorText text={error} />
      <Text style={s.attribution}>Google Haritalar verisi</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.line, padding: 14, marginTop: 8, marginBottom: 12 },
  title: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, marginBottom: 4 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 10, alignItems: 'center' },
  rule: { borderTopWidth: 1, borderTopColor: colors.line },
  name: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.ink },
  rating: { color: colors.ink, fontSize: 13, fontVariant: ['tabular-nums'] },
  attribution: { color: colors.muted, fontSize: 11, marginTop: 8, textAlign: 'right' },
});
