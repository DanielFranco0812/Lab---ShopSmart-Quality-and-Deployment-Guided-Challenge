// Customer sign-in helpers. Built on node:crypto only (no extra packages).
// - Passwords are stored as scrypt hashes with a random salt, never as plain text.
// - The session is a signed token in an httpOnly cookie, so browser JavaScript cannot read it.
import crypto from 'node:crypto';

export const SESSION_COOKIE = 'shopsmart_session';
const SESSION_DAYS = 7;
const SCRYPT_KEYLEN = 64;

let devSecret;

/** The secret that signs session tokens. Production must set SESSION_SECRET. */
export function getSessionSecret(env = process.env) {
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 32) return env.SESSION_SECRET;
  if (env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set (at least 32 characters) when NODE_ENV=production.');
  }
  // Local development only: a random secret per process, so sessions reset when the API restarts.
  devSecret ??= crypto.randomBytes(32).toString('hex');
  return devSecret;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('base64url');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = crypto.scryptSync(String(password), salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function sign(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

/** Returns "<payload>.<signature>" carrying the user id and an expiry time. */
export function createSessionToken(userId, { secret = getSessionSecret(), now = Date.now(), days = SESSION_DAYS } = {}) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: now + days * 864e5 })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the user id, or null when the token is missing, altered or expired. */
export function readSessionToken(token, { secret = getSessionSecret(), now = Date.now() } = {}) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature || '');
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isInteger(uid) || uid < 1 || typeof exp !== 'number' || exp <= now) return null;
    return uid;
  } catch {
    return null;
  }
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    try { cookies[name] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* ignore a malformed cookie */ }
  }
  return cookies;
}

/** Cookie settings. Secure (HTTPS only) in production unless COOKIE_SECURE=false is set for a local test. */
export function sessionCookieOptions(env = process.env) {
  const secure = env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production';
  return { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: SESSION_DAYS * 864e5 };
}

export function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

/** An order may be read only by the signed-in customer who placed it. */
export function canReadOrder(userId, order) {
  return Boolean(order) && Number.isInteger(userId) && order.userId === userId;
}
