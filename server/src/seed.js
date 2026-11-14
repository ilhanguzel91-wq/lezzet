/**
 * Demo data. Business names are FICTIONAL samples; coordinates are approximate.
 * Run directly (`npm run seed`) to reset the database, or import seedDemo(db).
 */
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { hashPassword } from './auth.js';
import { CITIES } from './roadnet.js';

const rand = (() => { let s = 42; return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31); })();

/** Point at fraction t between two cities, nudged sideways by up to offsetKm. */
function along(a, b, t, offsetKm = 1) {
  const A = CITIES[a], B = CITIES[b];
  const jitter = () => ((rand() - 0.5) * 2 * offsetKm) / 111;
  return [A[0] + (B[0] - A[0]) * t + jitter(), A[1] + (B[1] - A[1]) * t + jitter()];
}
const inCity = (c, km = 2.5) => along(c, c, 0, km);

// [name, cuisine, city, [lat,lng], price, tags, specialties, description]
const BUSINESSES = [
  ['Köprübaşı Ev Yemekleri', 'Ev yemekleri', 'İzmit', inCity('İzmit'), 1, ['helal', 'cocuk-dostu', 'aile-salonu'], ['Pişmaniye', 'Kuru fasulye'], 'Günlük pişen tencere yemekleri ve ev tatlıları.'],
  ['Sapanca Yolu Alabalık', 'Balık', 'Sakarya', along('İzmit', 'Sakarya', 0.7, 1), 2, ['cocuk-dostu', 'otopark', 'aile-salonu'], ['Alabalık tava', 'Islama köfte'], 'Göl kenarında taze alabalık.'],
  ['Adapazarı Islama Evi', 'Kebap & Izgara', 'Sakarya', inCity('Sakarya'), 2, ['helal'], ['Islama köfte'], 'Yöresel ıslama köfte ustası.'],
  ['Düzce Fındık Konağı', 'Kahvaltı', 'Düzce', inCity('Düzce'), 2, ['vejetaryen', 'yoresel-urun-satisi', 'cocuk-dostu'], ['Köy kahvaltısı', 'Fındıklı tatlılar'], 'Serpme köy kahvaltısı ve fındık ürünleri.'],
  ['Bolu Dağı Dinlenme Tesisi', 'Yöresel mutfak', 'Bolu', along('Düzce', 'Bolu', 0.55, 0.5), 2, ['otopark', 'cocuk-dostu', 'engelli-erisimi', 'yoresel-urun-satisi'], ['Mengen pilavı', 'Bolu keşi'], 'Yol üstü yöresel lezzetler, geniş otopark.'],
  ['Abant Yolu Gözleme', 'Sokak lezzetleri', 'Bolu', inCity('Bolu'), 1, ['vejetaryen', 'vegan'], ['Gözleme', 'Ayran'], 'Sacda el açması gözleme.'],
  ['Gerede Ocakbaşı', 'Kebap & Izgara', 'Gerede', along('Bolu', 'Gerede', 0.9, 0.7), 3, ['helal', 'otopark', 'aile-salonu'], ['Kuzu tandır', 'Ocakbaşı köfte'], 'Odun ateşinde kuzu tandır.'],
  ['Kızılcahamam Kaplıca Lokantası', 'Ev yemekleri', 'Ankara', along('Gerede', 'Ankara', 0.45, 1), 2, ['diyet-menu', 'glutensiz', 'cocuk-dostu'], ['Yayla çorbası', 'Etli bamya'], 'Hafif ve dengeli menüler.'],
  ['Ulus Tava Evi', 'Yöresel mutfak', 'Ankara', inCity('Ankara', 1.5), 2, ['helal', 'aile-salonu'], ['Ankara tava', 'Beypazarı kurusu'], 'Ankara mutfağının klasikleri.'],
  ['Kızılay Vegan Mutfak', 'Dünya mutfağı', 'Ankara', inCity('Ankara', 1.5), 2, ['vegan', 'vejetaryen', 'glutensiz', 'diyet-menu'], ['Mercimek köftesi', 'Kinoa salatası'], 'Tamamen bitkisel menü.'],
  ['Çankaya Pide Salonu', 'Pide & Lahmacun', 'Ankara', inCity('Ankara', 2), 1, ['helal', 'cocuk-dostu'], ['Kıymalı pide', 'Lahmacun'], 'Taş fırında pide.'],
  ['Uludağ Eteği İskender', 'Kebap & Izgara', 'Bursa', inCity('Bursa'), 3, ['helal', 'aile-salonu'], ['İskender', 'Kestane şekeri'], 'Tereyağlı İskender.'],
  ['Mudanya Yolu Balıkçısı', 'Balık', 'Bursa', along('İstanbul', 'Bursa', 0.85, 2), 3, ['otopark'], ['Mevsim balığı'], 'Günlük tutulan balık.'],
  ['Susurluk Ayran Durağı', 'Sokak lezzetleri', 'Balıkesir', along('Bursa', 'Balıkesir', 0.75, 0.8), 1, ['otopark', 'cocuk-dostu'], ['Susurluk tostu', 'Köpüklü ayran'], 'Yol üstü meşhur tost ve ayran.'],
  ['Balıkesir Höşmerim Evi', 'Tatlı', 'Balıkesir', inCity('Balıkesir'), 1, ['vejetaryen', 'yoresel-urun-satisi'], ['Höşmerim', 'Sütlü nuriye'], 'Yöresel tatlılar.'],
  ['Manisa Kebapçısı', 'Kebap & Izgara', 'Manisa', inCity('Manisa'), 2, ['helal'], ['Manisa kebabı', 'Mesir macunu'], 'Tereyağlı Manisa kebabı.'],
  ['Kemeraltı Boyozcusu', 'Kahvaltı', 'İzmir', inCity('İzmir', 1.5), 1, ['vejetaryen'], ['Boyoz', 'Haşlanmış yumurta'], 'Sabah boyoz ve çay.'],
  ['Alsancak Ege Otları', 'Ev yemekleri', 'İzmir', inCity('İzmir', 1.5), 2, ['vegan', 'vejetaryen', 'diyet-menu'], ['Ege otları', 'Zeytinyağlılar'], 'Zeytinyağlı Ege mutfağı.'],
  ['Germencik İncir Bahçesi', 'Kahvaltı', 'Aydın', along('İzmir', 'Aydın', 0.8, 1), 2, ['yoresel-urun-satisi', 'cocuk-dostu', 'otopark'], ['İncir reçeli', 'Köy kahvaltısı'], 'Bahçede kahvaltı, incir ürünleri.'],
  ['Denizli Tandır Sofrası', 'Yöresel mutfak', 'Denizli', inCity('Denizli'), 2, ['helal', 'aile-salonu'], ['Denizli kebabı'], 'Fırında kuzu kebabı.'],
  ['Eskişehir Çiğbörek Evi', 'Sokak lezzetleri', 'Eskişehir', inCity('Eskişehir'), 1, ['cocuk-dostu'], ['Çiğbörek', 'Met helvası'], 'Kırım Tatar mutfağından çiğbörek.'],
  ['Porsuk Kenarı Bistro', 'Dünya mutfağı', 'Eskişehir', inCity('Eskişehir'), 3, ['vejetaryen', 'glutensiz', 'engelli-erisimi'], ['Mevsim salatası'], 'Nehir kenarında modern mutfak.'],
  ['Bozüyük Yol Lokantası', 'Ev yemekleri', 'Eskişehir', along('Bursa', 'Eskişehir', 0.55, 1), 1, ['otopark', 'helal', 'cocuk-dostu'], ['Kuru fasulye', 'Pilav'], 'Şoförlerin uğrak yeri.'],
  ['Kütahya Cimcik Evi', 'Yöresel mutfak', 'Kütahya', inCity('Kütahya'), 1, ['vejetaryen'], ['Cimcik', 'Sıkma'], 'Yöresel hamur işleri.'],
  ['Sivrihisar Han Lokantası', 'Ev yemekleri', 'Sivrihisar', inCity('Sivrihisar', 1), 1, ['otopark', 'helal'], ['Tirit'], 'Tarihi han içinde ev yemekleri.'],
  ['Afyon Kaymak Sofrası', 'Kahvaltı', 'Afyonkarahisar', inCity('Afyonkarahisar'), 2, ['yoresel-urun-satisi', 'cocuk-dostu', 'aile-salonu'], ['Kaymaklı ekmek kadayıfı', 'Afyon sucuğu'], 'Manda kaymağı ile kahvaltı.'],
  ['Afyon Yol Üstü Sucukçu', 'Kebap & Izgara', 'Afyonkarahisar', along('Afyonkarahisar', 'Burdur', 0.12, 0.8), 2, ['helal', 'otopark', 'yoresel-urun-satisi'], ['Izgara sucuk', 'Afyon kaymağı'], 'Izgara sucuk ve yöresel ürün satışı.'],
  ['Dinar Pide Fırını', 'Pide & Lahmacun', 'Afyonkarahisar', along('Afyonkarahisar', 'Burdur', 0.5, 1), 1, ['helal', 'cocuk-dostu'], ['Etli pide'], 'Taş fırın pide.'],
  ['Isparta Gül Bahçesi', 'Tatlı', 'Isparta', inCity('Isparta'), 2, ['vejetaryen', 'yoresel-urun-satisi'], ['Gül lokumu', 'Gül reçeli'], 'Gül ürünleri ve tatlılar.'],
  ['Burdur Şiş Ustası', 'Kebap & Izgara', 'Burdur', inCity('Burdur'), 2, ['helal', 'aile-salonu'], ['Burdur şiş', 'Ceviz ezmesi'], 'Meşhur Burdur şiş.'],
  ['Bucak Dinlenme Durağı', 'Ev yemekleri', 'Burdur', along('Burdur', 'Antalya', 0.4, 0.8), 1, ['otopark', 'cocuk-dostu', 'engelli-erisimi'], ['Tarhana çorbası'], 'Yol üstü sıcak yemek.'],
  ['Kaleiçi Piyazcısı', 'Yöresel mutfak', 'Antalya', inCity('Antalya', 1.5), 2, ['vejetaryen', 'vegan'], ['Tahinli piyaz', 'Şiş köfte'], 'Antalya usulü tahinli piyaz.'],
  ['Konyaaltı Balık Evi', 'Balık', 'Antalya', inCity('Antalya', 3), 3, ['otopark', 'cocuk-dostu'], ['Levrek', 'Deniz börülcesi'], 'Deniz kenarında balık.'],
  ['Konya Etli Ekmek Fırını', 'Pide & Lahmacun', 'Konya', inCity('Konya'), 1, ['helal', 'aile-salonu', 'cocuk-dostu'], ['Etli ekmek', 'Fırın kebabı'], 'Bir metrelik etli ekmek.'],
  ['Pozantı Yol Lokantası', 'Ev yemekleri', 'Adana', along('Konya', 'Adana', 0.72, 1), 1, ['otopark', 'helal'], ['Tantuni', 'Şalgam'], 'Toroslar geçidinde sıcak yemek.'],
  ['Adana Kebap Ocağı', 'Kebap & Izgara', 'Adana', inCity('Adana'), 2, ['helal'], ['Adana kebap', 'Şalgam'], 'Zırh kıymasıyla Adana kebap.'],
  ['Antep Baklava Atölyesi', 'Tatlı', 'Gaziantep', inCity('Gaziantep'), 3, ['vejetaryen', 'yoresel-urun-satisi'], ['Fıstıklı baklava', 'Katmer'], 'Günlük taze baklava ve katmer.'],
  ['Gaziantep Beyran Evi', 'Yöresel mutfak', 'Gaziantep', inCity('Gaziantep'), 2, ['helal', 'glutensiz'], ['Beyran', 'Yuvalama'], 'Sabah beyranı.'],
];

const PRODUCTS = [
  ['Pişmaniye', 'İzmit', 'Kocaeli\'nin ince tel şeker tatlısı.'],
  ['Islama köfte', 'Sakarya', 'Et suyuna batırılmış ekmekle servis edilen köfte.'],
  ['Fındık', 'Düzce', 'Karadeniz fındığı ve fındık ezmeleri.'],
  ['Mengen pilavı', 'Bolu', 'Aşçılar diyarı Mengen\'in meşhur pilavı.'],
  ['Ankara tava', 'Ankara', 'Kuzu eti ve arpa şehriyeyle fırın yemeği.'],
  ['Kestane şekeri', 'Bursa', 'Bursa\'nın şekerlenmiş kestanesi.'],
  ['Höşmerim', 'Balıkesir', 'Peynir tatlısı.'],
  ['Mesir macunu', 'Manisa', 'Baharatlı geleneksel macun.'],
  ['Boyoz', 'İzmir', 'Sefarad kökenli hamur işi.'],
  ['Kuru incir', 'Aydın', 'Coğrafi işaretli Aydın inciri.'],
  ['Met helvası', 'Eskişehir', 'Eskişehir\'in geleneksel helvası.'],
  ['Afyon kaymağı', 'Afyonkarahisar', 'Manda sütünden kaymak.'],
  ['Afyon sucuğu', 'Afyonkarahisar', 'Coğrafi işaretli sucuk.'],
  ['Gül lokumu', 'Isparta', 'Isparta gülüyle yapılan lokum.'],
  ['Ceviz ezmesi', 'Burdur', 'Cevizli geleneksel tatlı.'],
  ['Etli ekmek', 'Konya', 'İnce, uzun kıymalı pide.'],
  ['Şalgam suyu', 'Adana', 'Mor havuç ve bulgurla fermente içecek.'],
  ['Antep fıstığı', 'Gaziantep', 'Coğrafi işaretli fıstık.'],
];

const COMMENTS = [
  'Yemekler çok lezzetliydi, porsiyonlar doyurucu.',
  'Temiz ve hızlı servis, yol üstü mola için ideal.',
  'Fiyatına göre gayet iyi, tekrar uğrarım.',
  'Yöresel tatları burada denemek güzeldi, çocuklar da sevdi.',
  'Biraz kalabalıktı ama beklemeye değdi.',
  '',
];

export async function seedDemo(db) {
  await db.tx(async (t) => {
    await t.run('TRUNCATE campaigns, reservations, points_ledger, ratings, visits, products, businesses, users RESTART IDENTITY CASCADE');
    const addUser = (name, email, pw, role) =>
      t.insert('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', name, email, hashPassword(pw), role);
    await addUser('Platform Yöneticisi', 'admin@lezzetrotasi.local', 'admin123', 'admin');
    const ownerId = await addUser('Demo İşletme Sahibi', 'isletme@lezzetrotasi.local', 'demo123', 'owner');
    await addUser('Demo Kullanıcı', 'kullanici@lezzetrotasi.local', 'demo123', 'user');
    const raterIds = [];
    for (const [i, n] of ['Ayşe Yılmaz', 'Mehmet Demir', 'Elif Kaya', 'Can Öztürk', 'Zeynep Arslan', 'Burak Çelik'].entries()) {
      raterIds.push(await addUser(n, `ornek${i + 1}@lezzetrotasi.local`, 'demo123', 'user'));
    }

    const nextYear = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    for (const [i, [name, cuisine, city, [lat, lng], price, tags, specialties, desc]] of BUSINESSES.entries()) {
      const id = await t.insert(
        `INSERT INTO businesses (owner_id, name, cuisine, city, address, phone, lat, lng, price_level, tags, specialties, description, opening_hours, qr_code, subscription_until, inspected_at, inspected_by)
         VALUES (?,?,?,?,?,?,?,?,?,?::jsonb,?::jsonb,?,?,?,?,?,?)`,
        i === 0 ? ownerId : null, name, cuisine, city, `${city} (örnek adres)`, '', lat, lng, price,
        JSON.stringify(tags), JSON.stringify(specialties), desc, '08:00–22:00', `demo-qr-${i + 1}`, nextYear, today, 'Saha Ekibi');
      const n = Math.floor(rand() * 5);
      for (let k = 0; k < n; k++) {
        const uid = raterIds[(i + k) % raterIds.length];
        const ago = `${10 + Math.floor(rand() * 200)} days`;
        const visitId = await t.insert('INSERT INTO visits (user_id, business_id, created_at) VALUES (?, ?, now() - ?::interval)', uid, id, ago);
        const score = 3 + Math.floor(rand() * 3);
        await t.run('INSERT INTO ratings (user_id, business_id, visit_id, score, taste, hygiene, value, comment, created_at) VALUES (?,?,?,?,?,?,?,?, now() - ?::interval)',
          uid, id, visitId, score, score, Math.min(5, score + (rand() > 0.5 ? 0 : -1)), score, COMMENTS[Math.floor(rand() * COMMENTS.length)], ago);
        await t.run('INSERT INTO points_ledger (user_id, points, reason) VALUES (?, ?, ?)', uid, 10, 'Puan verme');
      }
    }

    for (const [name, city, desc] of PRODUCTS) {
      await t.run('INSERT INTO products (name, city, description, lat, lng) VALUES (?,?,?,?,?)', name, city, desc, ...CITIES[city]);
    }

    const addCampaign = 'INSERT INTO campaigns (sponsor_type, sponsor_name, title, body, city, business_id, starts_at, ends_at) VALUES (?,?,?,?,?,?,?,?)';
    await t.run(addCampaign, 'belediye', 'Örnek Belediye (Afyonkarahisar)', 'Kaymak ve Sucuk Festivali', 'Yöresel üreticilerin stantları şehir meydanında.', 'Afyonkarahisar', null, today, nextYear);
    await t.run(addCampaign, 'uretici', 'Örnek Gıda Üreticisi', 'Yol arkadaşınız: kuruyemiş paketleri', 'Anlaşmalı duraklarda %10 indirim.', null, null, today, nextYear);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = await openDb();
  await seedDemo(db);
  await db.close();
  console.log('Demo veriler yüklendi (mevcut veriler silindi).');
}
