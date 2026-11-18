import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, DEMO } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { priceLabel, useMeta } from '../../lib/meta';
import { colors, fonts, radius } from '../../lib/theme';
import type { Business, Campaign, Product } from '../../lib/types';
import { CityPicker, MY_LOCATION } from '../../components/CityPicker';
import { RouteArt } from '../../components/home/RouteArt';
import { StarsDisplay } from '../../components/Stars';
import { Badge, Button } from '../../components/ui';

/** Hand-picked intercity routes with the specialities a traveller meets on the way. */
const POPULAR_ROUTES = [
  { from: 'İstanbul', to: 'Ankara', stops: 'Sapanca · Bolu Dağı · Gerede', taste: 'Alabalık, Mengen pilavı, kuzu tandır' },
  { from: 'Ankara', to: 'Antalya', stops: 'Sivrihisar · Afyon · Isparta', taste: 'Kaymaklı kahvaltı, sucuk, gül lokumu' },
  { from: 'İstanbul', to: 'İzmir', stops: 'Bursa · Susurluk · Manisa', taste: 'İskender, Susurluk tostu, boyoz' },
  { from: 'Konya', to: 'Gaziantep', stops: 'Pozantı · Adana', taste: 'Etli ekmek, Adana kebap, baklava' },
];

const CUISINE_MARK: Record<string, string> = {
  'Ev yemekleri': '🍲',
  'Kebap & Izgara': '🍢',
  'Pide & Lahmacun': '🫓',
  Balık: '🐟',
  Kahvaltı: '🍳',
  Tatlı: '🍯',
  'Yöresel mutfak': '🥘',
  'Sokak lezzetleri': '🥙',
  'Dünya mutfağı': '🥗',
};

export default function HomeScreen() {
  const meta = useMeta();
  const { user, rewards } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 720) - 32;

  const [from, setFrom] = useState<string | null>(MY_LOCATION);
  const [to, setTo] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [favourites, setFavourites] = useState<Business[]>([]);
  const [businessCount, setBusinessCount] = useState<number | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    api<Product[]>('/products').then(setProducts).catch(() => {});
    api<Business[]>('/businesses')
      .then((all) => {
        setBusinessCount(all.length);
        setFavourites(all.filter((b) => b.rating.count > 0).slice(0, 5));
      })
      .catch(() => {});
    api<Campaign[]>('/campaigns?city=Afyonkarahisar')
      .then((c) => setCampaign(c[0] ?? null))
      .catch(() => {});
  }, []);

  const openRoute = (f: string | null, t: string) =>
    router.push({ pathname: '/route', params: { to: t, ...(f && f !== MY_LOCATION ? { from: f } : {}) } });

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      {/* ---------- Hero ---------- */}
      <View style={[s.hero, { paddingTop: insets.top + 18 }]}>
        <View style={[s.inner, { width: contentWidth }]}>
          <View style={s.topBar}>
            <Text style={s.wordmark}>
              Lezzet <Text style={{ color: colors.saffron }}>Rotası</Text>
            </Text>
            <Pressable
              onPress={() => router.push(user ? '/profile' : '/login')}
              style={s.userPill}
              accessibilityRole="button"
            >
              <Text style={s.userPillText}>{user ? `${user.name.split(' ')[0]} · ${rewards?.points ?? 0} puan` : 'Giriş yap'}</Text>
            </Pressable>
          </View>

          <View style={s.art} pointerEvents="none">
            <RouteArt width={Math.min(contentWidth * 0.82, 360)} height={Math.min(contentWidth * 0.82, 360) * 0.375} />
          </View>

          <Text style={s.eyebrow}>YOL ÜSTÜ LEZZET REHBERİ</Text>
          <Text style={s.heroTitle}>Yolunuzun üstündeki en iyi sofralar</Text>
          <Text style={s.heroBody}>
            Nereye gittiğinizi seçin. Güzergâhtaki denetlenmiş lokantaları ve yöresel ürünleri yol sırasıyla gösterelim.
          </Text>

          <View style={s.searchPanel}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <CityPicker label="Nereden" value={from} cities={meta?.cities ?? []} allowMyLocation onChange={setFrom} />
              <CityPicker label="Nereye" value={to} cities={meta?.cities ?? []} onChange={setTo} />
            </View>
            <Button
              title={to ? `${to} yolundaki durakları göster` : 'Rotadaki durakları göster'}
              onPress={() => (to ? openRoute(from, to) : router.push('/route'))}
              style={{ marginTop: 10 }}
            />
          </View>
        </View>
      </View>

      <View style={[s.inner, { width: contentWidth }]}>
        {/* ---------- Facts ---------- */}
        <View style={s.facts}>
          <Fact n={businessCount ?? '–'} label="denetlenmiş durak" />
          <View style={s.factRule} />
          <Fact n={meta?.cities.length ?? '–'} label="şehir" />
          <View style={s.factRule} />
          <Fact n={products.length || '–'} label="yöresel ürün" />
        </View>

        {/* ---------- Popular routes ---------- */}
        <SectionHead title="Popüler rotalar" action="Kendi rotan" onAction={() => router.push('/route')} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.rail, { paddingHorizontal: Math.max(16, (width - contentWidth) / 2) }]}>
        {POPULAR_ROUTES.map((r) => (
          <Pressable
            key={r.from + r.to}
            onPress={() => openRoute(r.from, r.to)}
            style={({ pressed }) => [s.routeCard, pressed && s.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${r.from} - ${r.to} rotasını aç`}
          >
            <Text style={s.routeKm}>ROTA</Text>
            <Text style={s.routeName}>
              {r.from}
              <Text style={{ color: colors.accent }}> → </Text>
              {r.to}
            </Text>
            <Text style={s.routeStops}>{r.stops}</Text>
            <View style={s.routeTaste}>
              <Text style={s.routeTasteText}>{r.taste}</Text>
            </View>
            <Text style={s.link}>Durakları gör</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[s.inner, { width: contentWidth }]}>
        {/* ---------- Cuisines ---------- */}
        <SectionHead title="Canınız ne çekiyor?" />
        <View style={s.grid}>
          {(meta?.cuisines ?? Object.keys(CUISINE_MARK)).map((c) => (
            <Pressable
              key={c}
              onPress={() => router.push({ pathname: '/nearby', params: { cuisine: c } })}
              style={({ pressed }) => [s.tile, { width: (contentWidth - 16) / 3 }, pressed && s.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${c}: yakındaki işletmeler`}
            >
              <Text style={s.tileMark}>{CUISINE_MARK[c] ?? '🍽️'}</Text>
              <Text style={s.tileLabel} numberOfLines={2}>
                {c}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ---------- Sponsored ---------- */}
        {campaign && (
          <View style={s.sponsor}>
            <Badge label={`Sponsorlu · ${campaign.sponsorName}`} tone="warn" />
            <Text style={s.sponsorTitle}>{campaign.title}</Text>
            {!!campaign.body && <Text style={s.muted}>{campaign.body}</Text>}
          </View>
        )}

        {/* ---------- Regional products ---------- */}
        <SectionHead title="Yöresel tatlar" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.rail, { paddingHorizontal: Math.max(16, (width - contentWidth) / 2) }]}>
        {products.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => openRoute(null, p.city)}
            style={({ pressed }) => [s.productCard, pressed && s.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}, ${p.city}: rotayı aç`}
          >
            <Text style={s.productCity}>{p.city.toLocaleUpperCase('tr')}</Text>
            <Text style={s.productName}>{p.name}</Text>
            <Text style={s.productDesc} numberOfLines={3}>
              {p.description}
            </Text>
            <Text style={s.link}>{p.city} rotası</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[s.inner, { width: contentWidth }]}>
        {/* ---------- Favourites ---------- */}
        <SectionHead title="Gezginlerin favorileri" />
        <Text style={[s.muted, { marginTop: -6, marginBottom: 10 }]}>Yalnızca ziyareti doğrulanmış oylara göre sıralanır.</Text>
        <View style={s.list}>
          {favourites.map((b, i) => (
            <Pressable
              key={b.id}
              onPress={() => router.push(`/business/${b.id}`)}
              style={({ pressed }) => [s.favRow, i > 0 && s.favRule, pressed && s.pressed]}
              accessibilityRole="button"
            >
              <Text style={s.rank}>{i + 1}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.favName} numberOfLines={1}>
                  {b.name}
                </Text>
                <Text style={s.muted} numberOfLines={1}>
                  {b.city} · {b.cuisine} · {priceLabel(b.priceLevel)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <StarsDisplay value={b.rating.average} size={12} />
                <Text style={s.favScore}>
                  {b.rating.average} <Text style={s.muted}>({b.rating.count})</Text>
                </Text>
              </View>
            </Pressable>
          ))}
          {favourites.length === 0 && <Text style={[s.muted, { padding: 16 }]}>Yükleniyor…</Text>}
        </View>

        {/* ---------- How it works ---------- */}
        <SectionHead title="Nasıl çalışır?" />
        <View style={s.steps}>
          {[
            ['Rotanızı seçin', 'Başlangıç ve varış noktasını girin; yol üstündeki duraklar kilometre sırasıyla listelenir.'],
            ['Durakta QR okutun', 'Masadaki kodu okuttuğunuzda ziyaretiniz konumla doğrulanır.'],
            ['Puan verin, kazanın', 'Her oy puan kazandırır. 10 oyda bir çekiliş hakkı ve rozetler.'],
          ].map(([title, body], i) => (
            <View key={title} style={s.step}>
              <View style={s.stepNo}>
                <Text style={s.stepNoText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>{title}</Text>
                <Text style={s.muted}>{body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ---------- Rewards ---------- */}
        <View style={s.rewards}>
          {user && rewards ? (
            <>
              <Text style={s.rewardsEyebrow}>SEVİYENİZ</Text>
              <Text style={s.rewardsTitle}>
                {rewards.level} · {rewards.points} puan
              </Text>
              <Text style={s.rewardsBody}>
                {rewards.nextLevel ? `${rewards.nextLevel} seviyesine ${rewards.pointsToNext} puan kaldı. ` : ''}
                Sonraki çekiliş hakkına {rewards.ratingsToNextEntry} oy.
              </Text>
              <Button title="Ziyareti onayla, puan ver" onPress={() => router.push('/scan')} style={{ marginTop: 12 }} />
            </>
          ) : (
            <>
              <Text style={s.rewardsEyebrow}>GEZGİN PUANLARI</Text>
              <Text style={s.rewardsTitle}>Gittiğiniz her durak puan kazandırır</Text>
              <Text style={s.rewardsBody}>Doğrulanmış her oy 10 puan, detaylı yorum +5, yeni şehir +10.</Text>
              <Button title="Ücretsiz hesap aç" onPress={() => router.push('/login')} style={{ marginTop: 12 }} />
            </>
          )}
        </View>

        {DEMO && (
          <Text style={[s.muted, { textAlign: 'center', marginTop: 20 }]}>
            Tanıtım sürümü · İşletmeler ve yorumlar örnektir; yaptıklarınız yalnızca bu cihazda saklanır.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function Fact({ n, label }: { n: number | string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.factN}>{n}</Text>
      <Text style={s.factLabel}>{label}</Text>
    </View>
  );
}

function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && onAction && (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={s.link}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  inner: { alignSelf: 'center' },
  pressed: { opacity: 0.75 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  link: { color: colors.accent, fontFamily: fonts.displayMedium, fontSize: 14, marginTop: 10 },

  hero: { backgroundColor: colors.olive, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { fontFamily: fonts.displayHeavy, fontSize: 22, color: colors.onDark, letterSpacing: -0.5 },
  userPill: { borderWidth: 1, borderColor: 'rgba(251,246,238,0.35)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  userPillText: { color: colors.onDark, fontSize: 13, fontFamily: fonts.displayMedium },
  art: { marginTop: 14, marginBottom: 4, alignItems: 'flex-end' },
  eyebrow: { color: colors.saffron, fontSize: 12, letterSpacing: 1.4, fontFamily: fonts.displayMedium },
  heroTitle: { color: colors.onDark, fontFamily: fonts.displayHeavy, fontSize: 32, lineHeight: 36, letterSpacing: -0.8, marginTop: 6 },
  heroBody: { color: colors.onDarkMuted, fontSize: 15, lineHeight: 21, marginTop: 8 },
  searchPanel: { backgroundColor: colors.bg, borderRadius: radius + 4, padding: 10, marginTop: 18 },

  facts: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.line, paddingVertical: 14, marginTop: 16 },
  factRule: { width: 1, alignSelf: 'stretch', backgroundColor: colors.line },
  factN: { fontFamily: fonts.displayHeavy, fontSize: 22, color: colors.ink, fontVariant: ['tabular-nums'] },
  factLabel: { color: colors.muted, fontSize: 12 },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.ink, letterSpacing: -0.3 },

  rail: { gap: 12 },
  routeCard: { width: 250, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.line, padding: 16 },
  routeKm: { color: colors.muted, fontSize: 11, letterSpacing: 1.2, fontFamily: fonts.displayMedium },
  routeName: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginTop: 2, letterSpacing: -0.3 },
  routeStops: { color: colors.ink, fontSize: 13, marginTop: 6 },
  routeTaste: { backgroundColor: colors.saffronSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 10 },
  routeTasteText: { color: colors.warn, fontSize: 12, lineHeight: 16 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.line, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', minHeight: 92 },
  tileMark: { fontSize: 26 },
  tileLabel: { color: colors.ink, fontSize: 13, textAlign: 'center', marginTop: 6, fontFamily: fonts.displayMedium },

  sponsor: { backgroundColor: colors.warnSoft, borderRadius: radius, padding: 16, marginTop: 24, gap: 6 },
  sponsorTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },

  productCard: { width: 200, backgroundColor: colors.oliveSoft, borderRadius: radius, padding: 16 },
  productCity: { color: colors.ok, fontSize: 11, letterSpacing: 1.2, fontFamily: fonts.displayMedium },
  productName: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, marginTop: 4 },
  productDesc: { color: colors.ink, fontSize: 13, lineHeight: 18, marginTop: 6, minHeight: 54 },

  list: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.line },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  favRule: { borderTopWidth: 1, borderTopColor: colors.line },
  rank: { fontFamily: fonts.displayHeavy, fontSize: 20, color: colors.saffron, width: 20, textAlign: 'center' },
  favName: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.ink },
  favScore: { color: colors.ink, fontSize: 13, fontVariant: ['tabular-nums'], marginTop: 2 },

  steps: { gap: 14 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNo: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  stepNoText: { fontFamily: fonts.display, color: colors.accent, fontSize: 15 },
  stepTitle: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.ink, marginBottom: 2 },

  rewards: { backgroundColor: colors.olive, borderRadius: radius + 4, padding: 20, marginTop: 28 },
  rewardsEyebrow: { color: colors.saffron, fontSize: 12, letterSpacing: 1.4, fontFamily: fonts.displayMedium },
  rewardsTitle: { color: colors.onDark, fontFamily: fonts.display, fontSize: 22, lineHeight: 27, marginTop: 4 },
  rewardsBody: { color: colors.onDarkMuted, fontSize: 14, lineHeight: 20, marginTop: 6 },
});
