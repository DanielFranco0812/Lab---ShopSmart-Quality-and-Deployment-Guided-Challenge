# ShopSmart Grounded Assistant — Design Note

Team: ______________________  Date: ____________

## Request flow

```
AssistantPage.jsx (form)  ->  api.askAssistant()  ->  POST /api/assistant/questions
  -> routes/assistant.js: rate limit (20/min) -> zod validation (3–300 chars, else 422)
  -> Prisma: active products with stock > 0, public fields only
  -> groundedAssistant.answerQuestion()
       1. assistant.selectCatalogFacts()   (budget + keyword match, top 3)
       2. no facts?  -> honest "no match", provider NOT called
       3. aiProvider.requestGeminiDraft()  (server-side, key from backend/.env)
       4. verifyDraft()                    (ids, prices, stock, numbers)
       5. failure/rejection -> rule-based answer + notice
  -> JSON { answer, recommendedProducts, sources, mode, notice? }
  -> AssistantPage shows answer, notice, product links and a Sources list
```

## Five design decisions

1. **Fields sent to the provider.** Only `id, name, description, category, price, stock` of the (max 3) selected products, plus the question and parsed budget. That is all the answer needs: what it is, what it costs, whether it is available, and an id to cite. No orders, customer names, emails, addresses or timestamps are loaded by this route. Prisma `Decimal` prices are converted with `Number(...toFixed(2))` in `toCatalogFact`.

2. **Preventing invented ids/sources.** The model returns only `recommendedProductIds`. `verifyDraft` rejects any id not in this request's selected facts. `recommendedProducts` and `sources` are then built from our catalog facts, never from model text, so a name, price or link cannot be fabricated.

3. **No match.** If retrieval finds no active, in-stock, in-budget product matching the named product type, the server answers "I could not find an in-stock ShopSmart product…" with empty lists and does not call the provider. There is nothing to ground an answer on, and skipping the call saves quota.

4. **Provider unavailable.** Timeout (25 s, `AbortSignal.timeout`), HTTP 429, other HTTP errors, network failure, missing key and malformed JSON are mapped to `ProviderError` kinds. Each falls back to the rule-based answer (same products, prices and stock from the catalog) with a visible notice. The server log records the failure kind and Google's error reason, with the key redacted. The key and the request body are never logged. The frontend has a 35-second request timeout, so loading always ends.

5. **Public data and permissions.** Product name, description, category, price and stock are public catalog data. The assistant route is read-only: it never places orders or changes stock. *(If your team added accounts in Week 4: permissions stay enforced in the order/product-admin routes. The assistant needs no login because it only reads public product fields.)*

## Verification rules (`backend/src/services/verifyDraft.js`)

- The draft must be an object with an `answer` string (5–700 chars) and an integer id array (max 3).
- Every peso amount must equal a recommended product's current price or the customer's budget.
- Claims like "sold out" or "unavailable" are rejected (only in-stock products are sent). So are discount, warranty and shipping promises.
- Any other number must appear in the recommended products' facts. This catches invented specs like "60% layout".
- The answer must name a recommended product and must not name a selected product it did not link.

## Evidence

- Test that first failed: Catalog match. The page showed the yellow "AI service is unavailable" notice. The answer was still correct because the rule fallback ran.
- Cause: `node backend/scripts/checkGemini.js` printed `HTTP 404 NOT_FOUND: models/gemini-2.5-flash is no longer available to new users`.
- How we verified the fix: we set `GEMINI_MODEL=gemini-3.8-flash` in `backend/.env`, reran the check script (SUCCESS), restarted, and saw "Drafted by AI, verified against the catalog."

Example from the build: the starter's `parseBudget` read "1080p webcam" as a ₱1,080 budget, and its ranking recommended unrelated products for "running shoes". Both are fixed and covered by `backend/test/assistant.test.js`.

## Limitations

- Keyword retrieval doesn't understand synonyms (e.g. "earphones" vs "headset").
- Verification is deliberately strict, so some harmless AI drafts are replaced by the rule-based answer.

## Team contributions

| Member | Contribution | Issue resolved |
| --- | --- | --- |
| | | |
