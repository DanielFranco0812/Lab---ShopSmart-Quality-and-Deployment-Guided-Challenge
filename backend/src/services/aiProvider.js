// Server-side Gemini API call (REST generateContent endpoint).
// The API key is read from process.env on the server only. It is never returned or logged.

export class ProviderError extends Error {
  /** kind: not_configured | timeout | rate_limited | unavailable | invalid_format */
  constructor(kind, message, status) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
    this.status = status;
  }
}

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.8-flash';

function redact(text, secret) {
  return secret ? String(text).replaceAll(secret, '[redacted]') : String(text);
}

export function getProviderConfig(env = process.env) {
  return {
    provider: (env.AI_PROVIDER || 'gemini').toLowerCase(),
    apiKey: env.GEMINI_API_KEY || '',
    model: env.GEMINI_MODEL || DEFAULT_MODEL,
    baseUrl: env.GEMINI_API_BASE_URL || DEFAULT_BASE_URL,
    timeoutMs: Number(env.AI_TIMEOUT_MS || 25000),
    thinkingLevel: env.GEMINI_THINKING_LEVEL || 'low'
  };
}

const SYSTEM_INSTRUCTION = [
  'You are the ShopSmart product assistant for a classroom e-commerce store.',
  'Answer ONLY from the JSON product facts provided. Do not invent products, specifications, features, warranties, discounts, colors or delivery promises.',
  'Only mention prices exactly as given, written like ₱1,850.00. Only recommend products whose id appears in the facts.',
  'If no product in the facts fits the question, say so and return an empty recommendedProductIds list.',
  'Keep the answer to at most 3 short sentences. Do not ask for or mention personal information.'
].join(' ');

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING' },
    recommendedProductIds: { type: 'ARRAY', items: { type: 'INTEGER' } }
  },
  required: ['answer', 'recommendedProductIds']
};

// Gemini 3 models "think" before answering; a low thinking level keeps this short task fast.
export function buildGenerationConfig(config) {
  const generationConfig = { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA };
  if (/^gemini-3/.test(config.model) && config.thinkingLevel && config.thinkingLevel !== 'default') {
    generationConfig.thinkingConfig = { thinkingLevel: config.thinkingLevel };
  }
  return generationConfig;
}

export function buildPrompt(question, facts, budget) {
  return JSON.stringify({
    customerQuestion: question,
    customerBudgetPHP: budget,
    products: facts
  });
}

/**
 * Asks Gemini for a draft. Returns { answer, recommendedProductIds } (unverified!)
 * or throws ProviderError.
 */
export async function requestGeminiDraft({ question, facts, budget }, config = getProviderConfig(), fetchImpl = fetch) {
  if (config.provider === 'none' || config.provider === 'rules') throw new ProviderError('not_configured', 'AI provider disabled.');
  if (!config.apiKey) throw new ProviderError('not_configured', 'GEMINI_API_KEY is not set.');

  const url = `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text: buildPrompt(question, facts, budget) }] }],
        generationConfig: buildGenerationConfig(config)
      }),
      signal: AbortSignal.timeout(config.timeoutMs)
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new ProviderError('timeout', 'AI provider timed out.');
    const code = error?.cause?.code ? ` (${error.cause.code})` : '';
    throw new ProviderError('unavailable', `AI provider could not be reached${code}.`);
  }

  if (!response.ok) {
    // Gemini explains failures in { error: { status, message } }. Log that reason, never the key.
    const reason = await response.json().then((body) => `${body?.error?.status || ''} ${body?.error?.message || ''}`.trim()).catch(() => '');
    const safeReason = redact(reason, config.apiKey).slice(0, 200);
    const kind = response.status === 429 ? 'rate_limited' : 'unavailable';
    throw new ProviderError(kind, `AI provider returned HTTP ${response.status}${safeReason ? `: ${safeReason}` : ''}`, response.status);
  }

  let text;
  try {
    const body = await response.json();
    text = body?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
  } catch {
    throw new ProviderError('invalid_format', 'AI provider body was not JSON.');
  }
  if (!text) throw new ProviderError('invalid_format', 'AI provider returned no text.');

  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError('invalid_format', 'AI draft was not valid JSON.');
  }
}
