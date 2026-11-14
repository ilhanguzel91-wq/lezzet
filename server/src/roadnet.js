/**
 * Simplified Turkish intercity road network used as the offline routing fallback
 * when neither the Google Directions API nor OSRM is available.
 * Coordinates are approximate city centres; edges follow the main highways.
 */
export const CITIES = {
  'İstanbul': [41.0082, 28.9784],
  'İzmit': [40.7654, 29.9408],
  'Sakarya': [40.7569, 30.3781],
  'Düzce': [40.8438, 31.1565],
  'Bolu': [40.7350, 31.6061],
  'Gerede': [40.8000, 32.2000],
  'Ankara': [39.9334, 32.8597],
  'Bursa': [40.1885, 29.0610],
  'Balıkesir': [39.6484, 27.8826],
  'Manisa': [38.6191, 27.4289],
  'İzmir': [38.4237, 27.1428],
  'Aydın': [37.8560, 27.8416],
  'Denizli': [37.7765, 29.0864],
  'Eskişehir': [39.7767, 30.5206],
  'Kütahya': [39.4242, 29.9833],
  'Sivrihisar': [39.4500, 31.5400],
  'Afyonkarahisar': [38.7507, 30.5567],
  'Isparta': [37.7648, 30.5566],
  'Burdur': [37.7203, 30.2908],
  'Antalya': [36.8969, 30.7133],
  'Konya': [37.8746, 32.4932],
  'Adana': [37.0000, 35.3213],
  'Gaziantep': [37.0662, 37.3833],
};

export const ROADS = [
  ['İstanbul', 'İzmit'], ['İzmit', 'Sakarya'], ['Sakarya', 'Düzce'], ['Düzce', 'Bolu'],
  ['Bolu', 'Gerede'], ['Gerede', 'Ankara'],
  ['İstanbul', 'Bursa'], ['Bursa', 'Balıkesir'], ['Balıkesir', 'Manisa'], ['Manisa', 'İzmir'],
  ['İzmir', 'Aydın'], ['Aydın', 'Denizli'], ['Denizli', 'Burdur'],
  ['Bursa', 'Eskişehir'], ['Sakarya', 'Eskişehir'], ['Eskişehir', 'Ankara'], ['Eskişehir', 'Kütahya'],
  ['Eskişehir', 'Sivrihisar'], ['Ankara', 'Sivrihisar'], ['Sivrihisar', 'Afyonkarahisar'],
  ['Kütahya', 'Afyonkarahisar'], ['Afyonkarahisar', 'Burdur'], ['Afyonkarahisar', 'Isparta'],
  ['Isparta', 'Burdur'], ['Burdur', 'Antalya'], ['Isparta', 'Antalya'],
  ['Afyonkarahisar', 'Konya'], ['Ankara', 'Konya'], ['Konya', 'Adana'], ['Adana', 'Gaziantep'],
];
