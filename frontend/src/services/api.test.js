import { afterEach, describe, expect, it, vi } from 'vitest';
import { request } from './api.js';

// A fetch that never answers, like a frozen or cold-starting API. It only stops when the signal aborts.
function hangingFetch(_url, init = {}) {
  return new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(init.signal.reason));
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('api request timeout (DEF-1)', () => {
  it('ends with a useful message when the API never responds', async () => {
    vi.stubGlobal('fetch', vi.fn(hangingFetch));
    await expect(request('/products', {}, { timeoutMs: 50 })).rejects.toThrow('The request took too long. Please try again.');
  });

  it('applies a timeout by default, even when the caller passes none', async () => {
    const fetchSpy = vi.fn(async () => new Response('{"products":[]}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    await request('/products');
    expect(fetchSpy.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('can use an operation-specific timeout message', async () => {
    vi.stubGlobal('fetch', vi.fn(hangingFetch));
    await expect(request('/orders', { method: 'POST' }, { timeoutMs: 50, timeoutMessage: 'Order timed out.' }))
      .rejects.toThrow('Order timed out.');
  });

  it('still reports API error messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'INSUFFICIENT_STOCK', message: 'Only 4 unit(s) of 1080p Webcam are available.' } }), { status: 409 })));
    await expect(request('/orders', { method: 'POST' })).rejects.toMatchObject({ status: 409, code: 'INSUFFICIENT_STOCK', message: 'Only 4 unit(s) of 1080p Webcam are available.' });
  });
});
