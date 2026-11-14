import { openDb } from './db.js';
import { createApp } from './app.js';
import { seedDemo } from './seed.js';
import { hashPassword } from './auth.js';

const production = process.env.NODE_ENV === 'production';
const db = await openDb();

// Demo data: on by default locally, off by default in production (SEED_DEMO=1 forces it).
const seed = process.env.SEED_DEMO ? process.env.SEED_DEMO === '1' : !production;
if (seed && !(await db.get('SELECT 1 FROM businesses LIMIT 1'))) {
  await seedDemo(db);
  console.log('Veritabanı boştu, demo veriler yüklendi.');
}

// First administrator: created once from ADMIN_EMAIL + ADMIN_PASSWORD (e.g. from Secret Manager).
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const email = ADMIN_EMAIL.trim().toLowerCase();
  if (!(await db.get('SELECT 1 FROM users WHERE email = ?', email))) {
    if (ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD en az 12 karakter olmalı.');
    await db.run("INSERT INTO users (name, email, password_hash, role) VALUES ('Yönetici', ?, ?, 'admin')", email, hashPassword(ADMIN_PASSWORD));
    console.log(`Yönetici hesabı oluşturuldu: ${email}`);
  }
}

const port = Number(process.env.PORT || 4000);
const server = createApp(db).listen(port, '0.0.0.0', () => {
  console.log(`Lezzet Rotası API: http://localhost:${port}/api`);
  console.log(`Yönetim paneli:    http://localhost:${port}/admin`);
});

// Cloud Run sends SIGTERM before stopping an instance.
process.on('SIGTERM', () => server.close(() => db.close().finally(() => process.exit(0))));
