// Checks an AI draft against the catalog facts selected for THIS request.
// A provider response is only a draft: it is never treated as proof that a claim is true.

const MAX_ANSWER_LENGTH = 700;
const CURRENCY_AMOUNT = /(?:₱|\bphp\s?|\bp(?=\d))\s*(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*(?:pesos?|php)\b/gi;
const ANY_NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const UNAVAILABLE_CLAIM = /\b(out of stock|sold out|unavailable|not available|no stock|discontinued)\b/i;
const FORBIDDEN_PROMISES = /\b(discount|sale price|promo|free shipping|warranty|guarantee|delivered (?:today|tomorrow))\b/i;

const toNumber = (raw) => Number(String(raw).replaceAll(',', ''));

function numbersIn(text) {
  return (String(text).match(ANY_NUMBER) || []).map(toNumber);
}

/**
 * @returns {{ ok: true, answer: string, facts: object[] } | { ok: false, reason: string }}
 */
export function verifyDraft(draft, selectedFacts, budget = null) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return { ok: false, reason: 'draft_not_object' };
  const answer = typeof draft.answer === 'string' ? draft.answer.trim() : '';
  if (answer.length < 5 || answer.length > MAX_ANSWER_LENGTH) return { ok: false, reason: 'answer_length' };
  if (!Array.isArray(draft.recommendedProductIds)) return { ok: false, reason: 'ids_not_array' };

  // 1. Every id must belong to a product selected for this request.
  const factsById = new Map(selectedFacts.map((fact) => [fact.id, fact]));
  const ids = [...new Set(draft.recommendedProductIds.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || !factsById.has(id))) return { ok: false, reason: 'unknown_product_id' };
  if (ids.length > 3) return { ok: false, reason: 'too_many_products' };
  const recommended = ids.map((id) => factsById.get(id));

  // 2. Price claims must match a recommended product's current price, or echo the customer's budget.
  const allowedPrices = new Set(recommended.map((fact) => fact.price));
  if (budget !== null) allowedPrices.add(budget);
  for (const match of answer.matchAll(CURRENCY_AMOUNT)) {
    const amount = toNumber(match[1] ?? match[2]);
    if (!allowedPrices.has(amount)) return { ok: false, reason: 'unsupported_price' };
  }

  // 3. Availability: every selected product is in stock, so "out of stock" style claims are unsupported.
  if (UNAVAILABLE_CLAIM.test(answer)) return { ok: false, reason: 'unsupported_availability' };
  if (FORBIDDEN_PROMISES.test(answer)) return { ok: false, reason: 'unsupported_promise' };

  // 4. Any other number (e.g. "60% layout", "2-year", "RGB 16 million colors") must come from the facts.
  const allowedNumbers = new Set(budget === null ? [] : [budget]);
  for (const fact of recommended) {
    allowedNumbers.add(fact.price);
    allowedNumbers.add(fact.stock);
    numbersIn(`${fact.name} ${fact.description}`).forEach((n) => allowedNumbers.add(n));
  }
  if (numbersIn(answer).some((n) => !allowedNumbers.has(n))) return { ok: false, reason: 'unsupported_number' };

  // 5. If the draft recommends products, it must name at least one of them.
  if (recommended.length > 0 && !recommended.some((fact) => answer.toLowerCase().includes(fact.name.toLowerCase()))) {
    return { ok: false, reason: 'answer_does_not_name_product' };
  }

  // 6. It must not name a selected product it did not recommend (that would be an unlinked claim).
  const unlinked = selectedFacts.filter((fact) => !ids.includes(fact.id) && answer.toLowerCase().includes(fact.name.toLowerCase()));
  if (unlinked.length > 0) return { ok: false, reason: 'unlinked_product_named' };

  return { ok: true, answer, facts: recommended };
}
