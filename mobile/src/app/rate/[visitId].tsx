import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { colors, fonts, radius } from '../../lib/theme';
import type { Rewards } from '../../lib/types';
import { StarsInput } from '../../components/Stars';
import { Button, Card, ErrorText } from '../../components/ui';

export default function RateScreen() {
  const { visitId, name } = useLocalSearchParams<{ visitId: string; name?: string }>();
  const { refresh } = useAuth();
  const [score, setScore] = useState(0);
  const [taste, setTaste] = useState(0);
  const [hygiene, setHygiene] = useState(0);
  const [value, setValue] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!score) return setError('Lütfen genel puanı seçin.');
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ points: number; rewards: Rewards }>('/ratings', {
        method: 'POST',
        body: {
          visitId: Number(visitId),
          score,
          taste: taste || undefined,
          hygiene: hygiene || undefined,
          value: value || undefined,
          comment,
        },
      });
      await refresh();
      const extra = r.rewards.ratingsToNextEntry === 10 ? '\nYeni bir çekiliş hakkı kazandınız!' : `\nSonraki çekiliş hakkına ${r.rewards.ratingsToNextEntry} oy kaldı.`;
      Alert.alert('Teşekkürler!', `+${r.points} puan kazandınız. Seviyeniz: ${r.rewards.level}.${extra}`);
      router.replace('/profile');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>{name ?? 'Ziyaretiniz'} nasıldı?</Text>
      <Text style={s.muted}>Puanınız yalnızca doğrulanmış ziyaretlerden gelir; bu da işletmenin güvenilirliğini artırır.</Text>
      <Card style={{ marginTop: 16 }}>
        <StarsInput label="Genel" value={score} onChange={setScore} />
        <StarsInput label="Lezzet" value={taste} onChange={setTaste} />
        <StarsInput label="Hijyen" value={hygiene} onChange={setHygiene} />
        <StarsInput label="Fiyat/perf." value={value} onChange={setValue} />
      </Card>
      <TextInput
        style={s.input}
        multiline
        value={comment}
        onChangeText={setComment}
        placeholder="Deneyiminizi anlatın (30+ karakterlik yorumlar ekstra puan kazandırır)"
        maxLength={1000}
      />
      <ErrorText text={error} />
      <Button title="Gönder" onPress={submit} loading={busy} style={{ marginTop: 12 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 24, fontFamily: fonts.displayHeavy, color: colors.ink, letterSpacing: -0.4 },
  muted: { color: colors.muted, marginTop: 6 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    padding: 12,
    minHeight: 110,
    textAlignVertical: 'top',
    color: colors.ink,
  },
});
