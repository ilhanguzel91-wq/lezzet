import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { priceLabel, tagLabel, useMeta } from '../../lib/meta';
import { colors, fonts, radius } from '../../lib/theme';
import type { BusinessDetail } from '../../lib/types';
import { StarsDisplay } from '../../components/Stars';
import { Badge, Button, Card, Chip, Empty, ErrorText, SectionTitle } from '../../components/ui';

const pad = (n: number) => String(n).padStart(2, '0');
const tomorrow = () => {
  const d = new Date(Date.now() + 864e5);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function BusinessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const meta = useMeta();
  const { user } = useAuth();
  const [b, setB] = useState<BusinessDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<BusinessDetail>(`/businesses/${id}`).then(setB).catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <ErrorText text={error} />;
  if (!b) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;

  const directions = () =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}&travelmode=driving`);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: b.name }} />
      <Text style={s.title}>{b.name}</Text>
      <Text style={s.muted}>
        {b.cuisine} · {b.city} · {priceLabel(b.priceLevel)}
      </Text>
      <View style={s.row}>
        <StarsDisplay value={b.rating.average} size={18} />
        <Text style={s.muted}> {b.rating.average ? `${b.rating.average} · ${b.rating.count} doğrulanmış oy` : 'Henüz oy yok'}</Text>
      </View>
      {b.inspected && (
        <View style={{ marginTop: 6 }}>
          <Badge label={`Saha ekibince denetlendi · ${b.inspectedAt}`} tone="ok" />
        </View>
      )}
      {!!b.description && <Text style={s.body}>{b.description}</Text>}

      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 12 }}>
        <Button title="Yol tarifi al" onPress={directions} style={{ flex: 1 }} />
        {!!b.phone && <Button title="Ara" variant="ghost" onPress={() => Linking.openURL(`tel:${b.phone}`)} style={{ flex: 1 }} />}
      </View>
      <Button
        title="📷 Ziyareti onayla ve puan ver"
        variant="ghost"
        onPress={() => (user ? router.push('/scan') : router.push('/login'))}
      />

      <Card style={{ marginTop: 12 }}>
        <Info k="Adres" v={b.address} />
        <Info k="Çalışma saatleri" v={b.openingHours} />
        {b.specialties.length > 0 && <Info k="Öne çıkan lezzetler" v={b.specialties.join(', ')} />}
        {b.tags.length > 0 && <Info k="Özellikler" v={b.tags.map((t) => tagLabel(meta, t)).join(' · ')} />}
      </Card>

      {b.rating.count > 0 && (
        <Card>
          <Text style={s.h3}>Puan dağılımı</Text>
          <Score label="Lezzet" v={b.rating.taste} />
          <Score label="Hijyen" v={b.rating.hygiene} />
          <Score label="Fiyat / performans" v={b.rating.value} />
        </Card>
      )}

      {b.acceptsReservations && <ReservationForm businessId={b.id} loggedIn={!!user} />}

      {b.products.length > 0 && (
        <>
          <SectionTitle>{b.city} yöresel ürünleri</SectionTitle>
          {b.products.map((p) => (
            <Text key={p.id} style={s.body}>
              • <Text style={{ fontWeight: '600' }}>{p.name}</Text> — {p.description}
            </Text>
          ))}
        </>
      )}

      <SectionTitle>Yorumlar</SectionTitle>
      {b.ratings.length === 0 && <Empty text="İlk yorumu siz yapın." />}
      {b.ratings.map((r) => (
        <Card key={r.id}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Text style={{ fontWeight: '600', color: colors.ink }}>{r.userName}</Text>
            <StarsDisplay value={r.score} />
          </View>
          {!!r.comment && <Text style={s.body}>{r.comment}</Text>}
          <Text style={[s.muted, { fontSize: 12 }]}>{r.createdAt.slice(0, 10)} · Ziyareti doğrulandı</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={[s.muted, { fontSize: 12 }]}>{k}</Text>
      <Text style={{ color: colors.ink }}>{v}</Text>
    </View>
  );
}

function Score({ label, v }: { label: string; v: number | null }) {
  return (
    <View style={[s.row, { justifyContent: 'space-between', marginVertical: 2 }]}>
      <Text style={{ color: colors.ink }}>{label}</Text>
      <Text style={s.muted}>{v ?? '–'} / 5</Text>
    </View>
  );
}

function ReservationForm({ businessId, loggedIn }: { businessId: number; loggedIn: boolean }) {
  const [date, setDate] = useState(tomorrow());
  const [time, setTime] = useState('19:00');
  const [party, setParty] = useState(2);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!loggedIn) return router.push('/login');
    const when = new Date(`${date}T${time}:00`);
    if (Number.isNaN(when.getTime())) return setError('Tarih YYYY-AA-GG, saat SS:DD biçiminde olmalı.');
    setBusy(true);
    setError(null);
    try {
      await api('/reservations', { method: 'POST', body: { businessId, reservedFor: when.toISOString(), partySize: party, note } });
      Alert.alert('Rezervasyon talebi gönderildi', 'İşletme onayladığında Profilim sekmesinde göreceksiniz.');
      setNote('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={s.h3}>Rezervasyon</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput style={[s.input, { flex: 1.4 }]} value={date} onChangeText={setDate} placeholder="2026-12-31" accessibilityLabel="Tarih" />
        <TextInput style={[s.input, { flex: 1 }]} value={time} onChangeText={setTime} placeholder="19:30" accessibilityLabel="Saat" />
      </View>
      <View style={[s.row, { flexWrap: 'wrap', marginTop: 8 }]}>
        <Text style={[s.muted, { marginRight: 8 }]}>Kişi:</Text>
        {[1, 2, 3, 4, 6, 8].map((n) => (
          <Chip key={n} label={String(n)} active={party === n} onPress={() => setParty(n)} />
        ))}
      </View>
      <TextInput style={s.input} value={note} onChangeText={setNote} placeholder="Not (ör. bebek sandalyesi)" maxLength={300} />
      <ErrorText text={error} />
      <Button title="Rezervasyon yap" onPress={submit} loading={busy} style={{ marginTop: 8 }} />
    </Card>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 26, fontFamily: fonts.displayHeavy, color: colors.ink, letterSpacing: -0.5 },
  h3: { fontSize: 16, fontFamily: fonts.display, color: colors.ink, marginBottom: 8 },
  muted: { color: colors.muted },
  body: { color: colors.ink, marginTop: 8, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    padding: 10,
    marginTop: 8,
    color: colors.ink,
  },
});
