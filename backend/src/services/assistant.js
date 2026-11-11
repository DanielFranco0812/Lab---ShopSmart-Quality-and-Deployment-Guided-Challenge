// Catalog retrieval and the rule-based assistant.
// ShopSmart code (not the AI provider) decides which products are eligible.

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'you', 'your', 'are', 'any', 'have', 'has', 'with', 'what', 'which', 'who', 'can',
  'that', 'this', 'there', 'please', 'recommend', 'suggest', 'need', 'want', 'looking', 'find', 'show',
  'buy', 'sell', 'get', 'something', 'anything', 'item', 'items', 'product', 'products', 'good', 'best',
  'cheap', 'cheapest', 'affordable', 'below', 'under', 'less', 'than', 'within', 'budget', 'max',
  'maximum', 'upto', 'php', 'peso', 'pesos', 'price', 'cost', 'costs', 'around', 'about', 'some',
  'available', 'stock', 'shopsmart', 'from', 'one', 'not', 'more', 'cheaper', 'how', 'much', 'does', 'don',
  'is', 'do', 'me', 'my', 'to', 'of', 'in', 'on', 'or', 'an', 'a', 'it'
]);

const BUDGET_PATTERN = /(?:(?:₱|\bphp|\bp(?=\d))\s*(\d{2,7})(?:\.\d{1,2})?|\b(?:below|under|less than|cheaper than|within|max(?:imum)?|up to|budget(?: of| is)?|at most|not more than)\s*(?:₱|php\s?|p(?=\d))?\s*(\d{2,7})(?:\.\d{1,2})?|(\d{2,7})(?:\.\d{1,2})?\s*(?:pesos?|php)\b)/i;

/**
 * Returns the customer's maximum budget, or null.
 * A bare number is NOT treated as a budget, so "1080p webcam" or "16 inch laptop"
 * do not filter out every product.
 */
export function parseBudget(question) {
  const normalized = String(question).replaceAll(',', '');
  const match = normalized.match(BUDGET_PATTERN);
  if (!match) return null;
  return Number(match[1] ?? match[2] ?? match[3]);
}

function stem(term) {
  if (term.length > 4 && term.endsWith('es') && /(?:ch|sh|x|ss)es$/.test(term)) return term.slice(0, -2);
  if (term.length > 3 && term.endsWith('s') && !term.endsWith('ss')) return term.slice(0, -1);
  return term;
}

/** Meaningful search words from the question (stop words and pure numbers removed). */
export function extractTerms(question) {
  return [...new Set(String(question).toLowerCase().split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term) && !/^\d+$/.test(term))
    .map(stem))];
}

/** Products that may be recommended at all: active and in stock. */
export function isRecommendable(product) {
  return product.active !== false && Number(product.stock) > 0;
}

export function rankProducts(products, question) {
  const terms = extractTerms(question);
  const budget = parseBudget(question);
  return products
    .filter((product) => isRecommendable(product) && (budget === null || Number(product.price) <= budget))
    .map((product) => {
      const text = `${product.name} ${product.category} ${product.description}`.toLowerCase();
      return { ...product, score: terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0) };
    })
    // If the customer named something ("keyboard", "shoes"), only products that match it qualify.
    // If they only gave a budget ("anything under ₱1,000"), every in-budget product qualifies.
    .filter((product) => terms.length === 0 || product.score > 0)
    .sort((a, b) => b.score - a.score || Number(a.price) - Number(b.price));
}

/**
 * Public product facts that may be shown to the AI provider.
 * Prisma returns Decimal for price, so it is converted deliberately with Number().
 */
export function toCatalogFact(product) {
  return {
    id: Number(product.id),
    name: String(product.name),
    description: String(product.description),
    category: String(product.category),
    price: Number(Number(product.price).toFixed(2)),
    stock: Number(product.stock)
  };
}

export function selectCatalogFacts(products, question, limit = 3) {
  return rankProducts(products, question).slice(0, limit).map(toCatalogFact);
}

export function formatPeso(amount) {
  return `₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function noMatchResponse(question) {
  const budget = parseBudget(question);
  const budgetText = budget === null ? '' : ` within ${formatPeso(budget)}`;
  return {
    answer: `I could not find an in-stock ShopSmart product matching that request${budgetText}. Try a different product type or budget, or browse the full catalog.`,
    recommendedProducts: [],
    sources: []
  };
}

/** Builds the public response from verified catalog facts (never from model text). */
export function toResponseLists(facts) {
  return {
    recommendedProducts: facts.map(({ id, name, price, category, stock }) => ({ id, name, price, category, stock })),
    sources: facts.map(({ id, name, price, stock }) => ({ type: 'product', id, name, price, stock }))
  };
}

/** Rule-based answer. Used when no provider is configured or the provider draft is rejected. */
export function buildRuleBasedResponse(facts, question) {
  if (facts.length === 0) return noMatchResponse(question);
  const lines = facts.map((fact) => `${fact.name} (${formatPeso(fact.price)}, ${fact.stock} in stock)`);
  const intro = facts.length === 1 ? 'The best match in the current ShopSmart catalog is' : 'Matching in-stock products in the current ShopSmart catalog:';
  return { answer: `${intro} ${lines.join('; ')}.`, ...toResponseLists(facts) };
}

/** Kept for compatibility with the starter tests and any earlier code. */
export function buildAssistantResponse(products, question) {
  return buildRuleBasedResponse(selectCatalogFacts(products, question), question);
}
