import crypto from 'node:crypto';

const SECRET = process.env.AUTH_SECRET || 'gelistirme-anahtari-degistirin';
const TOKEN_TTL_SEC = 60 * 60 * 24 * 30;

if (!process.env.AUTH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('AUTH_SECRET ortam değişkeni production ortamında zorunludur.');
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export function issueToken(user) {
  const payload = Buffer.from(
    JSON.stringify({ sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readToken(token) {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}

/** Express middleware: sets req.user when a valid bearer token is present. */
export function authOptional(req, _res, next) {
  const h = req.headers.authorization || '';
  const data = readToken(h.startsWith('Bearer ') ? h.slice(7) : null);
  if (data) req.user = { id: data.sub, role: data.role };
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });
    if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    next();
  };
}
