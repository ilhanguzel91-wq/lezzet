# Lezzet Rotası

Seyahat güzergâhı üzerindeki anlaşmalı lezzet duraklarını ve yöresel ürünleri gösteren mobil uygulama ile sunucusu.

| Klasör | İçerik |
|---|---|
| `server/` | Node.js (Express + PostgreSQL) API ve saha ekibi yönetim paneli (`/admin`) |
| `deploy/` | Google Cloud kurulum betiği (Cloud Run + Cloud SQL). Ayrıntılar: [YAYINLAMA.md](YAYINLAMA.md) |
| `mobile/` | Expo / React Native mobil uygulama (iOS + Android), Google Maps ile |

## Proje maddelerinin karşılığı

| Proje metni | Uygulamadaki karşılığı |
|---|---|
| Rota üzerindeki lezzet durakları | **Rota** sekmesi: başlangıç (konum veya şehir) ve varış seçilir. Yoldan en fazla 5/10/20 km uzaktaki anlaşmalı işletmeler, yol boyunca sırasıyla ("120 km sonra") listelenir. |
| Damak tadı, sağlık, bütçe, aile durumu | Filtreler: vegan, vejetaryen, glütensiz, helal, diyet menü, çocuk dostu, aile salonu, engelli erişimi, otopark; mutfak türü; ₺–₺₺₺₺ bütçe; en düşük puan. Kullanıcının kayıtlı tercihleri varsayılan filtre olur. |
| Yöresel ürünler | Güzergâh üzerindeki şehirlerin yöresel ürünleri rota sonucunda ve işletme sayfasında gösterilir. |
| (a) Google Maps ile işletmeye ulaştırma | Uygulama içi Google Maps haritası. "Yol tarifi al" Google Haritalar navigasyonunu açar. |
| (b) Not vererek güvenilirliği artırma | Kullanıcı işletmedeki **QR kodu okutur**. Sunucu, telefonun işletmeye en fazla 300 m uzakta olduğunu GPS ile doğrular. Ancak bundan sonra genel puan ile lezzet, hijyen ve fiyat/performans puanı ve yorum verilebilir. Böylece sahte oy engellenir. |
| (c) Oy sayısına göre ödül, çekiliş hakkı | Puan defteri, 5 seviye (Çaylak → Lezzet Ustası), rozetler, **her 10 oyda 1 çekiliş hakkı**. |
| (d) Yıllık abonelik, sözleşme, saha ekibi | Yönetim paneli: işletme ekleme (sahip hesabıyla birlikte), denetim kaydı, abonelik bitiş tarihi, "+1 yıl" yenileme, askıya alma, **yazdırılabilir QR kod**. Aboneliği biten veya askıdaki işletme uygulamada görünmez. |
| İşletme, belediye ve üretici reklamları | Kampanyalar (`isletme`, `belediye`, `uretici`) rota üzerindeki şehirlere göre "Sponsorlu" etiketiyle gösterilir. |
| 2. aşama: yerel kullanıcılar, rezervasyon | **Yakınımda** sekmesi ve rezervasyon. İşletme sahibi rezervasyonları uygulamadaki Profil sekmesinden onaylar veya reddeder. |

**Güvenilirlik kuralı:** Ücret ödemek sıralamayı ve puanı etkilemez. Sıralama, doğrulanmış oyların ağırlıklı ortalamasına göre yapılır. Reklamlar her zaman "Sponsorlu" olarak ayrı gösterilir.

## Çalıştırma

Node.js 22.13 veya üzeri gerekir.

### Sunucu

```bash
cd server
npm install
npm start
```

- API: `http://localhost:4000/api`
- Yönetim paneli: `http://localhost:4000/admin`
- Yerelde veritabanı kurmanız gerekmez: gömülü PostgreSQL (PGlite) kullanılır ve `server/data/pglite` klasöründe tutulur. İlk açılışta örnek verilerle doldurulur. Sıfırlamak için `npm run seed`.
- Gerçek bir PostgreSQL'e bağlanmak için `DATABASE_URL=postgresql://kullanici:sifre@sunucu/veritabani` verin.
- Testler: `npm test`. Gerçek PostgreSQL ile de denemek için `TEST_DATABASE_URL=… npm test`.

Örnek veriler **hayalidir**: işletme adları uydurmadır, koordinatlar yaklaşıktır.

| Rol | E-posta | Şifre |
|---|---|---|
| Yönetici (saha ekibi) | admin@lezzetrotasi.local | admin123 |
| İşletme sahibi | isletme@lezzetrotasi.local | demo123 |
| Kullanıcı | kullanici@lezzetrotasi.local | demo123 |

Örnek işletmelerin QR kodu içeriği `lezzetrotasi:demo-qr-1`, `lezzetrotasi:demo-qr-2` … şeklindedir. Panelden yazdırılabilir.

Ortam değişkenleri:

| Değişken | Açıklama |
|---|---|
| `PORT` | Varsayılan 4000 |
| `AUTH_SECRET` | Oturum imza anahtarı. **Canlı ortamda zorunlu.** |
| `GOOGLE_MAPS_API_KEY` | Verilirse gerçek yol rotası Google Directions API'den alınır. |
| `OSRM_URL` | Alternatif ücretsiz rota sunucusu (ör. kendi OSRM kurulumunuz) |
| `DATABASE_URL` | PostgreSQL bağlantısı (Cloud SQL). Verilmezse gömülü PGlite kullanılır. |
| `PGLITE_DIR` | Gömülü veritabanı klasörü (varsayılan `server/data/pglite`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Verilirse bu yönetici hesabı ilk açılışta bir kez oluşturulur (şifre en az 12 karakter). |
| `VISIT_RADIUS_M` | QR onayında izin verilen mesafe (varsayılan 300 m) |
| `SEED_DEMO` | `1`: boş veritabanına örnek veri yükle, `0`: yükleme. Varsayılan: yerelde açık, `NODE_ENV=production` iken kapalı. |

Google anahtarı yoksa sunucu yerleşik şehirlerarası yol ağıyla **yaklaşık** rota hesaplar. Bu, deneme için yeterlidir.

### Mobil uygulama

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://<bilgisayarın-yerel-IP'si>:4000/api npx expo start
```

- Gerçek telefonda `localhost` telefonun kendisidir. Bu yüzden bilgisayarın yerel ağ IP'sini verin.
- Uygulama Google Maps ve kamera kullandığı için **development build** önerilir: `npx expo run:android` veya `npx eas-cli@latest build --profile development`.
- Google Maps anahtarları koda yazılmaz. `GOOGLE_MAPS_ANDROID_API_KEY` ve `GOOGLE_MAPS_IOS_API_KEY` ortam değişkenlerinden okunur (`app.config.js`). Ayrıntılar: [YAYINLAMA.md](YAYINLAMA.md).
- Kontroller: `npm run typecheck`, `npx expo lint`

## API özeti

| Uç nokta | Açıklama |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me`, `PUT /api/me/prefs` | Hesap ve tercihler |
| `GET /api/route?fromCity=İstanbul&toCity=Ankara&corridorKm=10&tags=vegan&maxPrice=2` | Rota, duraklar, yöresel ürünler, kampanyalar (`from=lat,lng` de olur) |
| `GET /api/businesses?lat=&lng=&radiusKm=` · `GET /api/businesses/:id` | Yakındakiler, işletme detayı |
| `POST /api/visits` `{qr, lat, lng}` · `POST /api/ratings` `{visitId, score, taste, hygiene, value, comment}` | Ziyaret onayı ve puan |
| `GET /api/me/visits`, `GET /api/me/points` | Kullanıcının ziyaretleri ve puan geçmişi |
| `POST /api/reservations`, `PATCH /api/reservations/:id`, `GET /api/me/reservations`, `GET /api/owner/reservations` | Rezervasyon |
| `GET /api/owner/businesses`, `PUT /api/owner/businesses/:id` | İşletme sahibi |
| `/api/admin/businesses` (GET, POST, PATCH), `/rotate-qr`, `GET /api/businesses/:id/qr`, `/api/admin/campaigns`, `/api/admin/stats` | Yönetim |

## Yayına almadan önce yapılması gerekenler

1. **Çekiliş için yasal izin:** Türkiye'de çekiliş düzenlemek Milli Piyango İdaresi'nin iznine tabidir. İzin alınana kadar çekiliş hakkı yalnızca sayaç olarak tutulur.
2. **KVKK:** Konum ve hesap verileri için aydınlatma metni ve açık rıza ekranı gerekir. Mağazalar da gizlilik politikası ister.
3. **Google Cloud kurulumu:** [YAYINLAMA.md](YAYINLAMA.md) dosyasındaki adımlar. Tek komutla Cloud Run ve Cloud SQL kurulur.
4. **Google Maps API anahtarları:** Kısıtlı (paket adına bağlı) anahtarlar oluşturun ve faturalandırmayı açın.
5. Abonelik ödemesi (fatura veya sanal POS), push bildirimleri (rezervasyon onayı) ve uygulama mağazası yayını (EAS Submit).
