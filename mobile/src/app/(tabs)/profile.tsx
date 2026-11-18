import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useMeta } from '../../lib/meta';
import { colors, fonts } from '../../lib/theme';
import type { Prefs, Reservation, Visit } from '../../lib/types';
import { Badge, Button, Card, Chip, Empty, SectionTitle } from '../../components/ui';

const STATUS: Record<Reservation['status'], { label: string; tone: 'warn' | 'ok' | 'danger' | 'neutral' }> = {
  pending: { label: 'Onay bekliyor', tone: 'warn' },
  confirmed: { label: 'Onaylandı', tone: 'ok' },
  rejected: { label: 'Reddedildi', tone: 'danger' },
  cancelled: { label: 'İptal', tone: 'neutral' },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function ProfileScreen() {
  const { user, rewards, logout, refresh, ready } = useAuth();
  const meta = useMeta();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [incoming, setIncoming] = useState<Reservation[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await refresh();
      const [v, r] = await Promise.all([api<Visit[]>('/me/visits'), api<Reservation[]>('/me/reservations')]);
      setVisits(v);
      setReservations(r);
      if (user.role !== 'user') setIncoming(await api<Reservation[]>('/owner/reservations'));
      setPrefs(user.prefs);
    } catch {
      // errors surface on the individual actions
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!ready) return null;
  if (!user || !rewards) {
    return (
      <View style={{ padding: 24, gap: 14 }}>
        <Text style={s.title}>Lezzet Rotası’na katılın</Text>
        <Text style={s.muted}>
          Gittiğiniz işletmelere puan verin, her 10 oyda bir çekiliş hakkı ve rozetler kazanın, rezervasyonlarınızı takip edin.
        </Text>
        <Button title="Giriş yap / Kayıt ol" onPress={() => router.push('/login')} />
      </View>
    );
  }

  async function setReservationStatus(id: number, status: Reservation['status']) {
    try {
      await api(`/reservations/${id}`, { method: 'PATCH', body: { status } });
      load();
    } catch (e) {
      Alert.alert('Hata', (e as Error).message);
    }
  }

  async function savePrefs(next: Prefs) {
    setPrefs(next);
    try {
      await api('/me/prefs', { method: 'PUT', body: next });
    } catch (e) {
      Alert.alert('Kaydedilemedi', (e as Error).message);
    }
  }

  const toggleTag = (t: string) => {
    const tags = prefs.tags ?? [];
    savePrefs({ ...prefs, tags: tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t] });
  };

  const progress = rewards.nextLevel ? 1 - rewards.pointsToNext / (rewards.points + rewards.pointsToNext || 1) : 1;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Text style={s.title}>Merhaba, {user.name.split(' ')[0]}</Text>

      <Card style={{ marginTop: 12 }}>
        <View style={s.between}>
          <View>
            <Text style={s.muted}>Seviye</Text>
            <Text style={s.big}>{rewards.level}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.muted}>Puan</Text>
            <Text style={s.big}>{rewards.points}</Text>
          </View>
        </View>
        <View style={s.bar}>
          <View style={[s.barFill, { width: `${Math.max(4, progress * 100)}%` }]} />
        </View>
        <Text style={s.muted}>
          {rewards.nextLevel ? `${rewards.nextLevel} seviyesine ${rewards.pointsToNext} puan kaldı` : 'En yüksek seviyedesiniz!'}
        </Text>
        <View style={[s.between, { marginTop: 12 }]}>
          <Stat n={rewards.ratingCount} label="Oy" />
          <Stat n={rewards.cityCount} label="Şehir" />
          <Stat n={rewards.drawEntries} label="Çekiliş hakkı" />
        </View>
        <Text style={[s.muted, { marginTop: 8 }]}>Sonraki çekiliş hakkına {rewards.ratingsToNextEntry} oy kaldı.</Text>
      </Card>

      <SectionTitle>Rozetler</SectionTitle>
      <View style={s.wrap}>
        {rewards.badges.map((b) => (
          <View key={b.id} style={{ marginRight: 6, marginBottom: 6 }}>
            <Badge label={(b.earned ? '🏅 ' : '🔒 ') + b.name} tone={b.earned ? 'accent' : 'neutral'} />
          </View>
        ))}
      </View>

      <SectionTitle>Ziyaretlerim</SectionTitle>
      <Button title="📷 QR okut, ziyareti onayla" variant="ghost" onPress={() => router.push('/scan')} style={{ marginBottom: 10 }} />
      {visits.length === 0 && <Empty text="Henüz doğrulanmış ziyaretiniz yok." />}
      {visits.slice(0, 10).map((v) => (
        <Card key={v.id}>
          <View style={s.between}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{v.businessName}</Text>
              <Text style={s.muted}>
                {v.city} · {v.createdAt.slice(0, 10)}
              </Text>
            </View>
            {v.ratedScore ? (
              <Badge label={`${v.ratedScore}★ verdiniz`} tone="ok" />
            ) : v.canRate ? (
              <Button
                title="Puan ver"
                onPress={() => router.push({ pathname: '/rate/[visitId]', params: { visitId: String(v.id), name: v.businessName } })}
              />
            ) : (
              <Badge label="Süre doldu" />
            )}
          </View>
        </Card>
      ))}

      <SectionTitle>Rezervasyonlarım</SectionTitle>
      {reservations.length === 0 && <Empty text="Rezervasyonunuz yok." />}
      {reservations.map((r) => (
        <Card key={r.id}>
          <View style={s.between}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{r.businessName}</Text>
              <Text style={s.muted}>
                {fmt(r.reservedFor)} · {r.partySize} kişi
              </Text>
            </View>
            <Badge label={STATUS[r.status].label} tone={STATUS[r.status].tone} />
          </View>
          {(r.status === 'pending' || r.status === 'confirmed') && new Date(r.reservedFor) > new Date() && (
            <Button title="İptal et" variant="ghost" style={{ marginTop: 8 }} onPress={() => setReservationStatus(r.id, 'cancelled')} />
          )}
        </Card>
      ))}

      {user.role !== 'user' && (
        <>
          <SectionTitle>İşletmeme gelen rezervasyonlar</SectionTitle>
          {incoming.length === 0 && <Empty text="Gelen rezervasyon yok." />}
          {incoming.map((r) => (
            <Card key={r.id}>
              <View style={s.between}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>
                    {r.userName} · {r.partySize} kişi
                  </Text>
                  <Text style={s.muted}>
                    {r.businessName} · {fmt(r.reservedFor)}
                  </Text>
                  {!!r.note && <Text style={{ color: colors.ink, marginTop: 4 }}>“{r.note}”</Text>}
                </View>
                <Badge label={STATUS[r.status].label} tone={STATUS[r.status].tone} />
              </View>
              {r.status === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Button title="Onayla" style={{ flex: 1 }} onPress={() => setReservationStatus(r.id, 'confirmed')} />
                  <Button title="Reddet" variant="ghost" style={{ flex: 1 }} onPress={() => setReservationStatus(r.id, 'rejected')} />
                </View>
              )}
            </Card>
          ))}
        </>
      )}

      <SectionTitle>Tercihlerim</SectionTitle>
      <Text style={[s.muted, { marginBottom: 8 }]}>Rota aramalarında varsayılan filtre olarak kullanılır.</Text>
      <View style={s.wrap}>
        {meta?.tags.map((t) => (
          <Chip key={t.id} label={t.label} active={(prefs.tags ?? []).includes(t.id)} onPress={() => toggleTag(t.id)} />
        ))}
      </View>
      <View style={s.wrap}>
        <Chip label="Bütçe: fark etmez" active={!prefs.maxPrice} onPress={() => savePrefs({ ...prefs, maxPrice: null })} />
        {[1, 2, 3].map((n) => (
          <Chip key={n} label={`En fazla ${'₺'.repeat(n)}`} active={prefs.maxPrice === n} onPress={() => savePrefs({ ...prefs, maxPrice: n })} />
        ))}
      </View>

      <Button title="Çıkış yap" variant="ghost" onPress={logout} style={{ marginTop: 24 }} />
    </ScrollView>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={s.big}>{n}</Text>
      <Text style={s.muted}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 26, fontFamily: fonts.displayHeavy, color: colors.ink, letterSpacing: -0.5 },
  muted: { color: colors.muted, fontSize: 13 },
  big: { fontSize: 24, fontFamily: fonts.displayHeavy, color: colors.ink },
  name: { fontFamily: fonts.displayMedium, color: colors.ink, fontSize: 15 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  bar: { height: 8, backgroundColor: colors.accentSoft, borderRadius: 99, marginVertical: 8, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: colors.accent, borderRadius: 99 },
});
