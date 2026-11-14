import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius } from '../lib/theme';
import { priceLabel, tagLabel } from '../lib/meta';
import type { Business, Meta } from '../lib/types';
import { StarsDisplay } from './Stars';
import { Badge } from './ui';

export function BusinessCard({ b, meta, mode }: { b: Business; meta: Meta | null; mode: 'route' | 'nearby' }) {
  const where =
    mode === 'route'
      ? `${b.alongKm} km sonra · yoldan ${b.offRouteKm} km`
      : `${b.distanceKm} km uzaklıkta`;
  return (
    <Pressable
      onPress={() => router.push(`/business/${b.id}`)}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
    >
      <View style={s.head}>
        <Text style={s.name} numberOfLines={1}>
          {b.name}
        </Text>
        <Text style={s.price}>{priceLabel(b.priceLevel)}</Text>
      </View>
      <Text style={s.meta}>
        {b.cuisine} · {b.city} · {where}
      </Text>
      <View style={s.ratingRow}>
        <StarsDisplay value={b.rating.average} />
        <Text style={s.meta}>
          {b.rating.average ? ` ${b.rating.average} (${b.rating.count} oy)` : ' Henüz oy yok'}
        </Text>
        {b.inspected && (
          <View style={{ marginLeft: 8 }}>
            <Badge label="Denetlendi" tone="ok" />
          </View>
        )}
      </View>
      {b.specialties.length > 0 && <Text style={s.spec}>Öne çıkan: {b.specialties.join(', ')}</Text>}
      {b.tags.length > 0 && (
        <Text style={s.tags} numberOfLines={1}>
          {b.tags.map((t) => tagLabel(meta, t)).join(' · ')}
        </Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 10,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink, flex: 1, marginRight: 8 },
  price: { color: colors.ok, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  spec: { color: colors.ink, fontSize: 13, marginTop: 6 },
  tags: { color: colors.accent, fontSize: 12, marginTop: 4 },
});
