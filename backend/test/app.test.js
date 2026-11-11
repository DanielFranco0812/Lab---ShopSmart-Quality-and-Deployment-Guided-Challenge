import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { escapeLikePattern } from '../src/lib/search.js';

// Starts the real Express app on a random port with an injected database check (no PostgreSQL needed).
async function withServer(options, run) {
  const server = createApp(options).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const originalError = console.error;
  console.error = () => {};
  try { await run(base); } finally { console.error = originalError; server.close(); }
}

test('health reports ok when the database answers (DEF-2)', async () => {
  await withServer({ checkDatabase: async () => {} }, async (base) => {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('health returns 503 when the database is unreachable (DEF-2)', async () => {
  await withServer({ checkDatabase: async () => { throw Object.assign(new Error('Cannot reach database'), { code: 'P1001' }); } }, async (base) => {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'error', database: 'unreachable' });
  });
});

test('malformed JSON returns 400 INVALID_JSON without echoing the body (DEF-3)', async () => {
  await withServer({ checkDatabase: async () => {} }, async (base) => {
    const response = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"customerName": oops' });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, 'INVALID_JSON');
    assert.equal(body.error.traceId, response.headers.get('x-request-id'));
    assert.ok(!JSON.stringify(body).includes('oops'));
  });
});

test('unexpected server errors never expose internal error codes (DEF-3)', async () => {
  const app = createApp({ checkDatabase: async () => {} });
  // Express 5: find the final error handler and call it directly with a Prisma-style error.
  const handler = app.router.stack.at(-1).handle;
  let status; let payload;
  const response = { status(code) { status = code; return this; }, json(body) { payload = body; } };
  const originalError = console.error; console.error = () => {};
  handler(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'P1001' }), { id: 'trace-1' }, response, () => {});
  console.error = originalError;
  assert.equal(status, 500);
  assert.equal(payload.error.code, 'INTERNAL_ERROR');
  assert.equal(payload.error.message, 'The server could not complete the request.');
  assert.equal(payload.error.traceId, 'trace-1');
});

test('search escapes SQL LIKE wildcards so "%" and "_" are literal (DEF-4)', () => {
  assert.equal(escapeLikePattern('%'), '\\%');
  assert.equal(escapeLikePattern('_'), '\\_');
  assert.equal(escapeLikePattern('50%_off\\'), '50\\%\\_off\\\\');
  assert.equal(escapeLikePattern('keyboard'), 'keyboard');
});
