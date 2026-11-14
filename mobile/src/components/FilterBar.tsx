import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import type { Filters, Meta } from '../lib/types';
import { Button, Chip, SectionTitle } from './ui';

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function FilterBar({ meta, value, onChange }: { meta: Meta | null; value: Filters; onChange: (f: Filters) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const count = value.tags.length + value.cuisines.length + (value.maxPrice ? 1 : 0) + (value.minRating ? 1 : 0);

  const quick = ['vegan', 'glutensiz', 'cocuk-dostu', 'helal', 'otopark'];
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
        <Chip
          label={count ? `Filtreler (${count})` : 'Filtreler'}
          active={count > 0}
          onPress={() => {
            setDraft(value);
            setOpen(true);
          }}
        />
        {quick.map((t) => (
          <Chip
            key={t}
            label={meta?.tags.find((x) => x.id === t)?.label ?? t}
            active={value.tags.includes(t)}
            onPress={() => onChange({ ...value, tags: toggle(value.tags, t) })}
          />
        ))}
      </ScrollView>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingTop: 48 }}>
          <SectionTitle>Bütçe (en fazla)</SectionTitle>
          <View style={st.wrap}>
            <Chip label="Fark etmez" active={!draft.maxPrice} onPress={() => setDraft({ ...draft, maxPrice: null })} />
            {[1, 2, 3, 4].map((n) => (
              <Chip key={n} label={'₺'.repeat(n)} active={draft.maxPrice === n} onPress={() => setDraft({ ...draft, maxPrice: n })} />
            ))}
          </View>

          <SectionTitle>En düşük puan</SectionTitle>
          <View style={st.wrap}>
            <Chip label="Fark etmez" active={!draft.minRating} onPress={() => setDraft({ ...draft, minRating: null })} />
            {[3, 4, 4.5].map((n) => (
              <Chip key={n} label={`${n}+ ★`} active={draft.minRating === n} onPress={() => setDraft({ ...draft, minRating: n })} />
            ))}
          </View>

          <SectionTitle>Beslenme ve ihtiyaçlar</SectionTitle>
          <View style={st.wrap}>
            {meta?.tags.map((t) => (
              <Chip key={t.id} label={t.label} active={draft.tags.includes(t.id)} onPress={() => setDraft({ ...draft, tags: toggle(draft.tags, t.id) })} />
            ))}
          </View>

          <SectionTitle>Mutfak</SectionTitle>
          <View style={st.wrap}>
            {meta?.cuisines.map((c) => (
              <Chip key={c} label={c} active={draft.cuisines.includes(c)} onPress={() => setDraft({ ...draft, cuisines: toggle(draft.cuisines, c) })} />
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <Button
              title="Temizle"
              variant="ghost"
              style={{ flex: 1 }}
              onPress={() => setDraft({ tags: [], cuisines: [], maxPrice: null, minRating: null })}
            />
            <Button
              title="Uygula"
              style={{ flex: 1 }}
              onPress={() => {
                onChange(draft);
                setOpen(false);
              }}
            />
          </View>
          <Pressable onPress={() => setOpen(false)} style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ color: colors.muted }}>Vazgeç</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({ wrap: { flexDirection: 'row', flexWrap: 'wrap' } });
