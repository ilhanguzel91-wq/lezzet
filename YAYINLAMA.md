# Google ile yayına alma rehberi

Bu rehber Lezzet Rotası'nı Google Cloud'a kurmayı ve uygulamayı Google Play'de yayınlamayı adım adım anlatır.

| Parça | Google hizmeti | Not |
|---|---|---|
| Sunucu (API + yönetim paneli) | **Cloud Run** | Kullanım yokken ücret yok, otomatik ölçeklenir |
| Veritabanı | **Cloud SQL — PostgreSQL 17** | Günlük otomatik yedek |
| Şifreler ve anahtarlar | **Secret Manager** | Kodda hiçbir şifre tutulmaz |
| Harita ve rota | **Google Maps Platform** | Uygulama haritası + sunucu tarafı rota |
| Android yayını | **Google Play Console** | 25 $ tek seferlik |
| iPhone yayını | Apple App Store (Google değil) | Apple Developer, 99 $/yıl |

## 1. Google Cloud projesi (bir kez)

1. https://console.cloud.google.com adresinde **yeni proje** oluşturun, örneğin `lezzet-rotasi`. Proje kimliğini (ID) not edin.
2. **Faturalandırma** hesabı bağlayın (Cloud SQL ve Maps için zorunlu).
3. Faturalandırma → **Bütçeler ve uyarılar** bölümünden aylık bütçe uyarısı kurun, örneğin 50 $. Beklenmedik harcamada e-posta gelir.

## 2. Sunucuyu kurma ve yayınlama

En kolayı tarayıcıdaki **Cloud Shell**'dir (konsolun sağ üstündeki `>_` simgesi). gcloud orada kurulu gelir.

```bash
git clone https://github.com/ilhanguzel91-wq/lezzet.git
cd lezzet
bash deploy/gcp-kurulum.sh
```

Betik önce proje kimliğini ve e-posta adresinizi sorar (köşeli parantezdeki değeri kabul etmek için yalnızca Enter'a basın). Faturalandırma kapalıysa bunu söyleyip durur. Sonra sırasıyla şunları yapar:
- Gerekli API'leri açar.
- PostgreSQL veritabanını kurar.
- Veritabanı şifresini, oturum anahtarını ve **ilk yönetici şifresini** üretip Secret Manager'a koyar. Yönetici şifresi ekrana bir kez yazılır, **hemen not edin**.
- Sunucuyu derleyip Cloud Run'a yükler.

Sonunda şuna benzer adresler çıkar:

```
API:            https://lezzet-api-xxxxx-ew.a.run.app/api
Yönetim paneli: https://lezzet-api-xxxxx-ew.a.run.app/admin
```

Kodda değişiklik yaptıktan sonra **aynı komutu tekrar çalıştırmak** yeni sürümü yayınlar. Var olan veritabanı ve şifrelere dokunulmaz.

Canlı ortamda örnek (hayali) işletmeler **yüklenmez**. Gerçek işletmeleri saha ekibi yönetim panelinden ekler.

## 3. Google Maps anahtarları

Konsolda **Google Maps Platform → Anahtarlar ve Kimlik Bilgileri** bölümünden üç ayrı anahtar oluşturun:

| Anahtar | Açılacak API | Kısıtlama |
|---|---|---|
| Android | Maps SDK for Android | Android uygulaması: `com.lezzetrotasi.app` + imza SHA-1 (Play Console → Uygulama bütünlüğü) |
| iOS | Maps SDK for iOS | iOS uygulaması: `com.lezzetrotasi.app` |
| Sunucu | Directions API | API kısıtlaması: yalnızca Directions API |

Sunucu anahtarını vermek için:

```bash
PROJECT_ID=<proje-kimliği> ADMIN_EMAIL=<e-posta> MAPS_SERVER_KEY=<sunucu-anahtarı> bash deploy/gcp-kurulum.sh
```

Sunucu anahtarı verilmezse rota, yerleşik yol ağıyla yaklaşık olarak hesaplanır. Uygulama yine çalışır ama mesafeler kabadır.

## 4. Mobil uygulamayı derleme (EAS)

Expo'nun bulut derleme hizmeti EAS kullanılır, bilgisayara Android Studio kurmak gerekmez.

```bash
cd mobile
npm install
npx eas-cli@latest login
npx eas-cli@latest init
```

Ortam değişkenlerini EAS'e girin (expo.dev → proje → Environment variables, ortam: production):

| Değişken | Değer | Görünürlük |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | 2. adımdaki API adresi (`…/api`) | Plain text |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Android anahtarı | Secret |
| `GOOGLE_MAPS_IOS_API_KEY` | iOS anahtarı | Secret |

Sonra derleyin:

```bash
npx eas-cli@latest build --platform android --profile production
```

Telefonda denemek için `--profile preview` ile doğrudan kurulabilir bir APK alırsınız.

## 5. Google Play'de yayınlama

1. https://play.google.com/console adresinde geliştirici hesabı açın (25 $, kimlik doğrulaması birkaç gün sürebilir).
2. **Uygulama oluştur:** ad "Lezzet Rotası", dil Türkçe, ücretsiz.
3. Mağaza girişini doldurun: kısa ve uzun açıklama, en az 2 ekran görüntüsü, 512×512 simge, 1024×500 öne çıkan görsel.
4. **Uygulama içeriği** bölümünde şunları doldurun:
   - Gizlilik politikası adresi (zorunlu)
   - Veri güvenliği formu: konum, e-posta ve ad toplanır; şifreli iletilir
   - İçerik derecelendirmesi
   - Hedef kitle
5. İlk derlemeyi yükleyin:

```bash
npx eas-cli@latest submit --platform android --profile production
```

   Bu komut **dahili test** kanalına yükler. İlk yüklemede Play Console bir hizmet hesabı anahtarı ister; EAS bunu adım adım anlatır.
6. Dahili testte sorun yoksa sürümü **Üretim** kanalına yükseltin. Google'ın ilk incelemesi birkaç gün sürebilir.

> Yeni kişisel geliştirici hesaplarında Google, üretime çıkmadan önce **en az 12 kişiyle 14 gün kapalı test** şartı koyabiliyor. Güncel koşulları Play Console'da kontrol edin. Şirket hesabıyla açılırsa bu şart genellikle uygulanmaz.

## 6. KVKK ve hukuki kontrol listesi

- [ ] Gizlilik politikası ve KVKK aydınlatma metni (uygulamada ve web'de)
- [ ] Konum için açık rıza metni
- [ ] Veriler AB'deki Google sunucularında (`europe-west1`, Belçika) tutuluyor. KVKK'nın yurt dışı aktarım hükümleri için hukukçuya danışın.
- [ ] Çekiliş için Milli Piyango İdaresi izni (alınana kadar çekiliş hakkı yalnızca sayaç olarak tutulur)
- [ ] İşletme abonelik sözleşmesi şablonu

## Tahmini aylık maliyet (başlangıç)

| Kalem | Tahmin |
|---|---|
| Cloud Run | Düşük trafikte ücretsiz kota içinde |
| Cloud SQL `db-f1-micro` | Aylık yaklaşık 10–15 $ |
| Secret Manager, Cloud Build | Ücretsiz kota içinde / birkaç sent |
| Google Maps | Aylık ücretsiz kullanım kotası var. Kullanıcı arttıkça artar, bütçe uyarısı kurun. |

Fiyatlar değişebilir; güncel rakamlar için Google Cloud fiyat hesaplayıcısını kullanın.
