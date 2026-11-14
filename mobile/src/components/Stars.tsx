import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';

export function StarsDisplay({ value, size = 14 }: { value: number | null; size?: number }) {
  const v = value ?? 0;
  return (
    <Text style={{ fontSize: size, color: colors.star }} accessibilityLabel={value ? `5 üzerinden ${value}` : 'Henüz puan yok'}>
      {'★'.repeat(Math.round(v))}
      <Text style={{ color: colors.line }}>{'★'.repeat(5 - Math.round(v))}</Text>
    </Text>
  );
}

export function StarsInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <View style={s.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${n} yıldız`}
          >
            <Text style={[s.star, { color: n <= value ? colors.star : colors.line }]}>★</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 },
  label: { fontSize: 15, color: colors.ink },
  stars: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 30 },
});
