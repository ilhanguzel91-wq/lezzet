export const POINTS = {
  rating: 10,
  detailedComment: 5, // comment of at least 30 characters
  newCity: 10, // first rating in a city
};

export const LEVELS = [
  { name: 'Çaylak', min: 0 },
  { name: 'Gezgin', min: 100 },
  { name: 'Gurme', min: 300 },
  { name: 'Lezzet Elçisi', min: 700 },
  { name: 'Lezzet Ustası', min: 1500 },
];

/** Every N ratings earns one draw entry (çekiliş hakkı). */
export const RATINGS_PER_DRAW_ENTRY = 10;

const BADGES = [
  { id: 'ilk-oy', name: 'İlk Oy', test: (s) => s.ratingCount >= 1 },
  { id: 'tat-avcisi', name: 'Yöresel Tat Avcısı', test: (s) => s.ratingCount >= 10 },
  { id: 'yerel-rehber', name: 'Yerel Rehber', test: (s) => s.ratingCount >= 25 },
  { id: 'rota-kasifi', name: 'Rota Kaşifi', test: (s) => s.cityCount >= 5 },
  { id: 'detayci', name: 'Detaycı Yorumcu', test: (s) => s.detailedCount >= 5 },
];

export function levelFor(points) {
  let idx = 0;
  LEVELS.forEach((l, i) => { if (points >= l.min) idx = i; });
  const next = LEVELS[idx + 1] || null;
  return { level: LEVELS[idx].name, nextLevel: next?.name ?? null, pointsToNext: next ? next.min - points : 0 };
}

export async function rewardSummary(db, userId) {
  const points = Number((await db.get('SELECT COALESCE(SUM(points),0)::int AS p FROM points_ledger WHERE user_id = ?', userId)).p);
  const s = await db.get(`
    SELECT COUNT(*)::int AS "ratingCount",
           COUNT(DISTINCT b.city)::int AS "cityCount",
           COALESCE(SUM(CASE WHEN length(r.comment) >= 30 THEN 1 ELSE 0 END), 0)::int AS "detailedCount"
    FROM ratings r JOIN businesses b ON b.id = r.business_id WHERE r.user_id = ?`, userId);
  const stats = { ratingCount: s.ratingCount, cityCount: s.cityCount, detailedCount: s.detailedCount };
  return {
    points,
    ...levelFor(points),
    ...stats,
    drawEntries: Math.floor(stats.ratingCount / RATINGS_PER_DRAW_ENTRY),
    ratingsToNextEntry: RATINGS_PER_DRAW_ENTRY - (stats.ratingCount % RATINGS_PER_DRAW_ENTRY),
    badges: BADGES.map((b) => ({ id: b.id, name: b.name, earned: b.test(stats) })),
  };
}
