// Orchestrates: retrieve catalog facts -> (optional) AI draft -> verify -> respond.
import { parseBudget, selectCatalogFacts, buildRuleBasedResponse, noMatchResponse, toResponseLists } from './assistant.js';
import { ProviderError, requestGeminiDraft } from './aiProvider.js';
import { verifyDraft } from './verifyDraft.js';

const FALLBACK_NOTICES = {
  not_configured: 'AI drafting is not configured, so this answer was built directly from catalog rules.',
  timeout: 'The AI service took too long, so this answer was built directly from catalog rules.',
  rate_limited: 'The AI service is busy right now, so this answer was built directly from catalog rules.',
  unavailable: 'The AI service is unavailable, so this answer was built directly from catalog rules.',
  invalid_format: 'The AI service returned an unreadable reply, so this answer was built directly from catalog rules.',
  unverified: 'The AI draft included details we could not verify, so this answer was built directly from catalog rules.'
};

/**
 * @param {object[]} products active products from the database
 * @param {string} question validated customer question
 * @param {{ draftProvider?: Function, log?: Function }} options
 */
export async function answerQuestion(products, question, { draftProvider = requestGeminiDraft, log = () => {} } = {}) {
  const budget = parseBudget(question);
  const facts = selectCatalogFacts(products, question);

  // No eligible product: answer honestly WITHOUT calling the provider.
  if (facts.length === 0) return { ...noMatchResponse(question), mode: 'no_match' };

  let draft;
  try {
    draft = await draftProvider({ question, facts, budget });
  } catch (error) {
    const kind = error instanceof ProviderError ? error.kind : 'unavailable';
    log(`assistant provider fallback: ${kind} - ${error?.message || 'unknown error'}`);
    return { ...buildRuleBasedResponse(facts, question), mode: 'rules', notice: FALLBACK_NOTICES[kind] };
  }

  const verified = verifyDraft(draft, facts, budget);
  if (!verified.ok) {
    log(`assistant draft rejected: ${verified.reason}`);
    return { ...buildRuleBasedResponse(facts, question), mode: 'rules', notice: FALLBACK_NOTICES.unverified };
  }

  // Product lists come from verified catalog facts, never from model text.
  return { answer: verified.answer, ...toResponseLists(verified.facts), mode: 'ai' };
}
