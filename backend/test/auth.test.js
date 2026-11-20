import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { canReadOrder, createSessionToken, getSessionSecret, hashPassword, parseCookies, readSessionToken, sessionCookieOptions, verifyPassword } from '../src/lib/auth.js';
import { requireUser } from '../src/middleware/session.js';
import { loginSchema, registerSchema } from '../src/validators/schemas.js';

const secret = 'x'.repeat(40);

test('passwords are stored as salted hashes and verified correctly', () => {
  const stored = hashPassword('Correct-Horse-7');
  assert.match(stored, /^scrypt\$/);
  assert.ok(!stored.includes('Correct-Horse-7'));
  assert.notEqual(stored, hashPassword('Correct-Horse-7'), 'same password gets a different salt');
  assert.equal(verifyPassword('Correct-Horse-7', stored), true);
  assert.equal(verifyPassword('wrong-password', stored), false);
  assert.equal(verifyPassword('anything', 'not-a-hash'), false);
});

test('a session token returns its user id, and rejects tampering and expiry', () => {
  const token = createSessionToken(42, { secret, now: 1000 });
  assert.equal(readSessionToken(token, { secret, now: 2000 }), 42);
  assert.equal(readSessionToken(token, { secret: 'y'.repeat(40), now: 2000 }), null, 'wrong secret');
  const [payload, signature] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ uid: 1, exp: 9e15 })).toString('base64url');
  assert.equal(readSessionToken(`${forged}.${signature}`, { secret, now: 2000 }), null, 'changed user id');
  assert.equal(readSessionToken(`${payload}.`, { secret, now: 2000 }), null, 'missing signature');
  assert.equal(readSessionToken(token, { secret, now: 1000 + 8 * 864e5 }), null, 'expired after 7 days');
  assert.equal(readSessionToken(undefined, { secret }), null);
});

test('production refuses to start without a strong SESSION_SECRET', () => {
  assert.throws(() => getSessionSecret({ NODE_ENV: 'production' }), /SESSION_SECRET/);
  assert.throws(() => getSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: 'short' }), /SESSION_SECRET/);
  assert.equal(getSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: secret }), secret);
});

test('session cookie is httpOnly, and HTTPS-only in production', () => {
  assert.equal(sessionCookieOptions({ NODE_ENV: 'production' }).secure, true);
  assert.equal(sessionCookieOptions({ NODE_ENV: 'development' }).secure, false);
  assert.equal(sessionCookieOptions({ NODE_ENV: 'production' }).httpOnly, true);
  assert.equal(sessionCookieOptions({ NODE_ENV: 'production' }).sameSite, 'lax');
});

test('cookies are parsed from the request header', () => {
  assert.deepEqual(parseCookies('a=1; shopsmart_session=abc.def'), { a: '1', shopsmart_session: 'abc.def' });
  assert.deepEqual(parseCookies(''), {});
});

test('only the customer who placed an order may read it', () => {
  const order = { id: 7, userId: 3 };
  assert.equal(canReadOrder(3, order), true, 'owner');
  assert.equal(canReadOrder(4, order), false, 'another customer');
  assert.equal(canReadOrder(null, order), false, 'guest');
  assert.equal(canReadOrder(3, { id: 8, userId: null }), false, 'old order with no owner');
  assert.equal(canReadOrder(3, null), false, 'missing order');
});

test('requireUser refuses a guest and a deleted account, and allows a real customer', async () => {
  const run = async (userId, findUser) => {
    let status; let nextCalled = false;
    const request = { userId };
    const response = { status(code) { status = code; return this; }, json() { return this; } };
    await requireUser(findUser)(request, response, () => { nextCalled = true; });
    return { status, nextCalled, user: request.user };
  };
  assert.equal((await run(null, async () => ({ id: 1 }))).status, 401);
  assert.equal((await run(5, async () => null)).status, 401);
  const ok = await run(5, async (id) => ({ id, name: 'Ana Test' }));
  assert.equal(ok.nextCalled, true);
  assert.equal(ok.user.id, 5);
});

test('account forms are validated', () => {
  assert.equal(registerSchema.safeParse({ name: 'Ana Test', email: 'ana@example.com', password: 'longenough' }).success, true);
  assert.equal(registerSchema.safeParse({ name: 'Ana Test', email: 'ana@example.com', password: 'short' }).success, false);
  assert.equal(registerSchema.safeParse({ name: 'A', email: 'not-an-email', password: 'longenough' }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'ana@example.com', password: '' }).success, false);
});

test('a guest gets 401 on every order route (no database needed)', async () => {
  const server = createApp({ checkDatabase: async () => {} }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/orders`;
  try {
    for (const [url, init] of [[base, {}], [`${base}/1`, {}], [base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }]]) {
      const response = await fetch(url, init);
      assert.equal(response.status, 401, `${init.method || 'GET'} ${url}`);
      assert.equal((await response.json()).error.code, 'AUTH_REQUIRED');
    }
    const forged = await fetch(`${base}/1`, { headers: { Cookie: 'shopsmart_session=bogus.token' } });
    assert.equal(forged.status, 401, 'a made-up cookie is refused');
  } finally { server.close(); }
});
