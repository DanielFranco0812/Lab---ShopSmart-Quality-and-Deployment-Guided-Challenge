import test from 'node:test';
import assert from 'node:assert/strict';
import { answerQuestion } from '../src/services/groundedAssistant.js';
import { ProviderError, requestGeminiDraft } from '../src/services/aiProvider.js';
import { verifyDraft } from '../src/services/verifyDraft.js';
import { seeded } from './fixtures/catalog.js';

const KEYBOARD_Q = 'Which keyboard is below ₱2,000?';
const keyboardFact = { id: 12, name: 'Compact Mechanical Keyboard', description: 'Hot-swappable compact keyboard with tactile switches.', category: 'Accessories', price: 1850, stock: 8 };

test('a supported AI draft is returned with catalog-built products and sources', async () => {
  const result = await answerQuestion(seeded, KEYBOARD_Q, {
    draftProvider: async () => ({ answer: 'The Compact Mechanical Keyboard costs ₱1,850.00 and is in stock with 8 units.', recommendedProductIds: [12] })
  });
  assert.equal(result.mode, 'ai');
  assert.deepEqual(result.recommendedProducts.map((p) => p.id), [12]);
  assert.deepEqual(result.sources.map((s) => s.id), [12]);
  assert.equal(result.recommendedProducts[0].price, 1850);
});

test('no match: provider is NOT called and nothing is invented', async () => {
  let called = false;
  const result = await answerQuestion(seeded, 'Do you sell running shoes?', { draftProvider: async () => { called = true; } });
  assert.equal(called, false);
  assert.equal(result.mode, 'no_match');
  assert.deepEqual(result.recommendedProducts, []);
  assert.deepEqual(result.sources, []);
  assert.match(result.answer, /could not find/i);
});

test('an invented product id is rejected and the rule fallback is used', async () => {
  const result = await answerQuestion(seeded, KEYBOARD_Q, {
    draftProvider: async () => ({ answer: 'Try the Ultra Keyboard.', recommendedProductIds: [999] })
  });
  assert.equal(result.mode, 'rules');
  assert.deepEqual(result.sources.map((s) => s.id), [12]);
  assert.ok(result.notice);
});

test('an unsupported price claim is rejected', () => {
  const verdict = verifyDraft({ answer: 'The Compact Mechanical Keyboard is only ₱1,500.', recommendedProductIds: [12] }, [keyboardFact], 2000);
  assert.deepEqual(verdict, { ok: false, reason: 'unsupported_price' });
});

test('an invented specification number is rejected', () => {
  const verdict = verifyDraft({ answer: 'The Compact Mechanical Keyboard has a 60% layout and costs ₱1,850.', recommendedProductIds: [12] }, [keyboardFact], 2000);
  assert.deepEqual(verdict, { ok: false, reason: 'unsupported_number' });
});

test('an unsupported availability claim is rejected', () => {
  const verdict = verifyDraft({ answer: 'The Compact Mechanical Keyboard is sold out.', recommendedProductIds: [12] }, [keyboardFact], 2000);
  assert.equal(verdict.ok, false);
});

test('malformed provider output is rejected', () => {
  assert.equal(verifyDraft('hello', [keyboardFact]).ok, false);
  assert.equal(verifyDraft({ answer: 'ok fine', recommendedProductIds: '12' }, [keyboardFact]).ok, false);
});

for (const kind of ['timeout', 'rate_limited', 'unavailable', 'invalid_format', 'not_configured']) {
  test(`provider ${kind} falls back to a useful rule-based answer`, async () => {
    const result = await answerQuestion(seeded, KEYBOARD_Q, { draftProvider: async () => { throw new ProviderError(kind, kind); } });
    assert.equal(result.mode, 'rules');
    assert.deepEqual(result.recommendedProducts.map((p) => p.id), [12]);
    assert.match(result.answer, /Compact Mechanical Keyboard/);
    assert.ok(result.notice);
  });
}

test('requestGeminiDraft maps HTTP 429 to rate_limited and never echoes the key', async () => {
  const config = { provider: 'gemini', apiKey: 'secret-test-key', model: 'm', baseUrl: 'http://x', timeoutMs: 1000 };
  await assert.rejects(
    requestGeminiDraft({ question: 'q', facts: [], budget: null }, config, async () => new Response('{}', { status: 429 })),
    (error) => error.kind === 'rate_limited' && !error.message.includes('secret-test-key')
  );
});

test('requestGeminiDraft maps a network failure to unavailable', async () => {
  const config = { provider: 'gemini', apiKey: 'k', model: 'm', baseUrl: 'http://x', timeoutMs: 1000 };
  await assert.rejects(
    requestGeminiDraft({ question: 'q', facts: [], budget: null }, config, async () => { throw new TypeError('fetch failed'); }),
    (error) => error.kind === 'unavailable'
  );
});

test('requestGeminiDraft without a key reports not_configured', async () => {
  await assert.rejects(
    requestGeminiDraft({ question: 'q', facts: [], budget: null }, { provider: 'gemini', apiKey: '' }),
    (error) => error.kind === 'not_configured'
  );
});

test('requestGeminiDraft parses a Gemini JSON reply', async () => {
  const config = { provider: 'gemini', apiKey: 'k', model: 'gemini-test', baseUrl: 'http://x', timeoutMs: 1000 };
  let sentHeaders;
  const fakeFetch = async (_url, init) => {
    sentHeaders = init.headers;
    const text = JSON.stringify({ answer: 'Hi', recommendedProductIds: [12] });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
  };
  const draft = await requestGeminiDraft({ question: 'q', facts: [keyboardFact], budget: 2000 }, config, fakeFetch);
  assert.deepEqual(draft.recommendedProductIds, [12]);
  assert.equal(sentHeaders['x-goog-api-key'], 'k');
});

test('Gemini 3 requests ask for a low thinking level; other models do not', async () => {
  const { buildGenerationConfig } = await import('../src/services/aiProvider.js');
  assert.deepEqual(buildGenerationConfig({ model: 'gemini-3.8-flash', thinkingLevel: 'low' }).thinkingConfig, { thinkingLevel: 'low' });
  assert.equal(buildGenerationConfig({ model: 'gemini-2.5-flash', thinkingLevel: 'low' }).thinkingConfig, undefined);
});
