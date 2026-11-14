import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../lib/theme';
import type { City } from '../lib/types';

export const MY_LOCATION = '__konumum__';

export function CityPicker({
  label,
  value,
  cities,
  allowMyLocation,
  onChange,
}: {
  label: string;
  value: string | null;
  cities: City[];
  allowMyLocation?: boolean;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const items = useMemo(() => {
    const filtered = cities
      .map((c) => c.name)
      .filter((n) => n.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')))
      .sort((a, b) => a.localeCompare(b, 'tr'));
    return allowMyLocation ? [MY_LOCATION, ...filtered] : filtered;
  }, [cities, q, allowMyLocation]);

  const display = value === MY_LOCATION ? '📍 Konumum' : value ?? 'Seçin';
  return (
    <>
      <Pressable style={s.field} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${display}`}>
        <Text style={s.label}>{label}</Text>
        <Text style={[s.value, !value && { color: colors.muted }]}>{display}</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 48 }}>
          <TextInput placeholder="Şehir ara…" value={q} onChangeText={setQ} style={s.search} autoFocus />
          <FlatList
            data={items}
            keyExtractor={(i) => i}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={s.row}
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                  setQ('');
                }}
              >
                <Text style={s.rowText}>{item === MY_LOCATION ? '📍 Konumum' : item}</Text>
              </Pressable>
            )}
          />
          <Pressable onPress={() => setOpen(false)} style={{ padding: 18, alignItems: 'center' }}>
            <Text style={{ color: colors.muted }}>Kapat</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  field: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  label: { fontSize: 12, color: colors.muted },
  value: { fontSize: 15, color: colors.ink, fontWeight: '600', marginTop: 2 },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    padding: 12,
    fontSize: 16,
  },
  row: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowText: { fontSize: 16, color: colors.ink },
});
