# ShopSmart Quality and Deployment Challenge — Test Record

Project: ShopSmart (`ASC_REST-main`) · Release candidate **RC1** (package version 1.0.0) · Test date **11 November 2026**

Team re-run with team members' names: same day, 22:15 (UTC+8); log `evidence/06-journey-team-names.txt`.

**Test environment.** All cases below were run on 11 Nov 2026 against a full local replica:
- Linux, Node 22.23, PostgreSQL 16.15, Chrome (headless, driven by Playwright)
- the team's unchanged code at baseline, then with the fixes in §4

Prisma's engine download server was blocked in that environment. The same Prisma 6.19.3 client therefore ran in driver-adapter mode (`@prisma/adapter-pg`, test harness only, not added to the project). Application code, schema, migration and SQL behaviour were identical.

**The team must repeat the §5 smoke test on the Windows machine** with `npm run dev`, and attach those screenshots as the final submission evidence.

Recorder: ______________ · Runners/observers: ______________

---

## 1. Activity 1 — Baseline

| Item | Result |
| --- | --- |
| PostgreSQL started, migration applied | 3 tables created from `20260910095532_initial_schema`; seeded 6 products |
| `npm run check` (before any change) | **PASS** (exit 0). Frontend lint ✓, backend lint ✓, frontend 4/4 tests, backend 31/31 tests, Vite build ✓ (two harmless `"use client"` bundler warnings from react-router). Log: `evidence/01-baseline-check.txt` |
| `GET /api/health` | `200 {"status":"ok"}` |
| `GET /api/products` | 6 products |
| Home page `http://localhost:5173` | 6 product cards (`screenshots/release/A1-home.png`) |

### Feature inventory (what the team actually implemented)

| Feature | Status |
| --- | --- |
| Product list, details, search, category filter, sort | Present |
| Cart: add, +/−, type quantity, remove, stock cap | Present. Cart is in-memory (not persisted). |
| Simulated checkout with server-side validation, price lookup and transactional stock decrement | Present |
| Grounded assistant: retrieval → Gemini draft → `verifyDraft` → rule fallback, with sources | Present |
| **Live AI (Gemini)** | **Present** (`aiProvider.js`), optional; falls back to rules when there is no key |
| **Authentication / roles** | **Absent.** No users, login or protected routes. No route lists or reads orders (`GET /api/orders` → 404), so no customer record can be fetched by anyone. The guest/owner/other-customer tests therefore do not apply. |
| Health endpoint | Present |
| Rate limit on assistant (20/min), Helmet headers, CORS to one origin | Present |

---

## 2. Activity 2 — Customer journey test cases

Fictional test data was used throughout. Each case follows the template: starting state → action and data → expected → observed and evidence → decision.

### TC-01 Browse
- **Starting state:** fresh seed, API and frontend running.
- **Action:** open `http://localhost:5173`.
- **Expected:** 6 cards with name, price, stock label; no error.
- **Observed:** 6 cards (Wireless Mouse ₱650.00 … USB Headset ₱1,350.00). Evidence: `A1-home.png`.
- **Decision:** **Pass.**

### TC-02 Search — relevant result
- **Action:** type `keyboard` in *Search products*.
- **Expected:** only keyboard products.
- **Observed:** 1 card, "Compact Mechanical Keyboard". API `GET /api/products?search=keyboard` returned the same. Evidence: `A2-search-keyboard.png`.
- **Decision:** **Pass.**

### TC-03 Search — no results state
- **Action:** type `running shoes`.
- **Expected:** no cards and a helpful message.
- **Observed:** 0 cards, "No products match your filters." Evidence: `A3-search-no-results.png`.
- **Decision:** **Pass.**

### TC-04 Search — special characters
- **Action:** type `%` (also `_` via API).
- **Expected:** no products, since no product name contains `%` or `_`.
- **Observed:** **all 6 products returned.** API `?search=%25` → 6, `?search=_` → 6. Evidence: `A4-search-percent-BEFORE-fix.png`, `evidence/02-api-probe.txt`.
- **Decision:** **Fail → DEF-4.** After fix: 0 products (`A4-search-percent-AFTER-fix.png`). **Pass after fix.**

### TC-05 Cart — add, change quantity, remove, refresh

Starting state: empty cart. Values recorded before and after each action:

| Action | Cart lines | Header | Total |
| --- | --- | --- | --- |
| Add Wireless Mouse ×2 | Mouse ×2 = ₱1,300 | Cart (2) | ₱1,300 |
| Add 1080p Webcam | + Webcam ×1 = ₱1,450 | Cart (3) | ₱2,750 ✓ |
| Type Mouse qty `3` | Mouse ×3 = ₱1,950 | Cart (4) | ₱3,400 ✓ |
| Click − on Mouse | Mouse ×2 = ₱1,300 | Cart (3) | ₱2,750 ✓ |
| Type Webcam qty `7` (stock 6) | unchanged; message "Only 6 unit(s) are available." | Cart (3) | ₱2,750 ✓ |
| Remove Webcam | Mouse ×2 | Cart (2) | ₱1,300 ✓ |
| Add Headset, then press browser Refresh | cart empty | Cart (0) | — |

- **Expected:** totals = Σ price × qty after every action. Quantity above stock refused. Refresh behaviour as designed.
- **Observed:** all totals correct. Stock cap enforced. The refresh empties the cart because `CartContext` keeps it in React state only; this is the team's current design (see Limitation L-1). Evidence: `B1-cart-two-items.png`, `B2-cart-after-remove.png`, `B3-cart-after-refresh.png`.
- **Decision:** **Pass** (refresh behaviour recorded as a known limitation).

### TC-06 Checkout — invalid details refused
- **Starting state:** Laptop Stand ×1 in cart.
- **Browser action:** name `Daniel Jehd`, email `jehdfranco.com` (no @), address `Anao, Mexico, Pampanga` → *Place simulated order*.
  - **Expected:** refused, no order.
  - **Observed:** browser blocked submit ("Please include an '@' in the email address. 'jehdfranco.com' is missing an '@'."); stayed on the form; order count unchanged. Evidence: (screenshot not included: it showed personal details).
- **Short address (Igor Toledano, address `Anao`):** with the browser hint bypassed, the API refused it: page shows "Check the customer and cart information.", API `422` with `fieldErrors.address` (min 10 characters). Evidence: (screenshot not included: it showed personal details), `evidence/06-journey-team-names.txt`. The same refusal happened on the team's Windows PC when the browser autofilled a 4-character address (autofill skips the browser's `minlength` check, so the server-side rule is what protected the data).
- **API actions** (bypassing the browser):

  | Request | Response |
  | --- | --- |
  | bad email | `422 INVALID_ORDER` with `fieldErrors.email` |
  | name `J`, address `short`, empty items | `422` with field errors |
  | quantity `1.5` | `422` |
  | productId 999 | `422 PRODUCT_UNAVAILABLE` |

  Evidence: `evidence/02-api-probe.txt`.
- **Decision:** **Pass.**

### TC-07 Checkout — valid fictional details create exactly one order
- **Action:** fix email to `jehdfranco01@gmail.com` → submit once.
- **Expected:** one order created; confirmation with order number and correct total; cart cleared.
- **Observed:** "Thank you, Daniel Jehd! Your simulated order number is #8. Total: ₱1,200.00". Header Cart (0). DB: order count 7 → 8; Laptop Stand stock 9 → 8.
  - API order with a tampered `"price":1` field returned `201`, `total 1300` (2 × ₱650): the server ignores client prices.
  - Evidence: (screenshot not included: it showed personal details), `evidence/02-api-probe.txt`.
- **Decision:** **Pass.**

### TC-08 Stock — cannot buy beyond stock
- **Action A (UI):** click *Add to cart* on 1080p Webcam 7 times (stock 6).
  - **Observed:** cart stops at 6, message "Only 6 unit(s) of 1080p Webcam are available."
- **Action B (stale cart):** with 6 webcams in the cart (customer Daniel Jehd), another customer, Kian Robe, buys 2 via the API (`201`, order #9). Then *Place simulated order*.
  - **Expected:** refused with a stock message; cart and orders unchanged.
  - **Observed:** "Only 4 unit(s) of 1080p Webcam are available." Cart still 6 × ₱1,450 = ₱8,700. No new order. Stock unchanged. Evidence: (screenshot not included: it showed personal details).
- **Action C (API):** `POST /api/orders` webcam qty 7 → `409 INSUFFICIENT_STOCK`. Order count 0 → 0 and all stock values unchanged before/after.
- **Decision:** **Pass.**

### TC-09 Assistant — supported catalog question
- **Action:** *AI Assistant* → "Which keyboard is below ₱2,000?"
- **Expected:** Compact Mechanical Keyboard, ₱1,850.00, linked product and source; nothing invented.
- **Observed (no API key, rules mode):** "The best match in the current ShopSmart catalog is Compact Mechanical Keyboard (₱1,850.00, 8 in stock)." Link → `/products/2` showing ₱1,850.00 and "8 unit(s) available". Sources (1) = Product #2. Notice: "AI drafting is not configured…". Evidence: `E1-assistant-keyboard.png`.
- **Observed (AI mode, using a local stand-in for Gemini):**
  - Honest draft → `mode: "ai"`, answer shown with source #2.
  - Draft inventing "UltraKey Pro … ₱999 with free shipping" (id 999) → rejected (`unknown_product_id`). The catalog answer was shown with notice "The AI draft included details we could not verify…".
  - Evidence: `evidence/02-assistant-ai-mode.txt`.
- **Decision:** **Pass.**

### TC-10 Assistant — honest no match and invalid input

| Question | Observed |
| --- | --- |
| "Do you sell running shoes?" | "I could not find an in-stock ShopSmart product matching that request…", 0 links, Sources (0), provider not called |
| "Do you have earphones?" | same honest no-match (synonym gap; see L-3) |
| `"hi"` | `422 INVALID_QUESTION` |
| `12345` (number) | `422 INVALID_QUESTION` |

Evidence: `E2-assistant-nomatch.png`. **Decision:** **Pass.**

### TC-11 Failure — API stopped
- **Action:** stop the API, open the home page, ask the assistant.
- **Expected:** loading ends with a useful message.
- **Observed:**
  - Products page, in 0.3 s: "ShopSmart could not reach the server. Check that the API is running and try again."
  - Assistant, in 0.1 s: same message; button re-enabled.
  - Evidence: `F1-api-down-products.png`, `F1-api-down-assistant.png`.
- **Decision:** **Pass.**

### TC-12 Failure — API accepts connections but never answers
This simulates a frozen server or a hosted API waking from sleep.
- **Action:** a listener on port 3000 that accepts but never responds; open the home page; place an order.
- **Expected:** loading ends with a useful message.
- **Observed:**
  - Products stayed on "Loading products…" for more than 20 s.
  - **Checkout stayed on "Submitting order…" for more than 30 s, with no way out.**
  - Only the assistant ended, after 35 s.
  - Evidence: `F2-api-hangs-products-BEFORE-fix.png`, `F2-api-hangs-checkout-BEFORE-fix.png`.
- **Decision:** **Fail → DEF-1.**
- **After fix:**
  - Products end at 15.7 s: "The request took too long. Please try again."
  - Checkout (customer James Mercado) ends at 15.4 s: "The server took too long to confirm your order. It may still have been placed, so please wait a moment before trying again." Button re-enabled.
  - Evidence: `F2-api-hangs-products-AFTER-fix.png`.
  - **Pass after fix.**

### TC-13 Failure — AI provider unreachable / slow
- **Action:** `GEMINI_API_KEY=fake-test-key GEMINI_API_BASE_URL=http://127.0.0.1:9` (unreachable); then a provider that never answers, with `AI_TIMEOUT_MS=3000`.
- **Expected:** fallback answer with notice; no endless loading.
- **Observed:**
  - Unreachable, in 0.2 s: notice "The AI service is unavailable…" plus the correct keyboard answer and source.
  - Slow, in 3.4 s: "The AI service took too long…" plus the same answer.
  - Server log records `fallback: unavailable` / `timeout`; the key is not printed.
  - Evidence: `F3-ai-unreachable.png`, `F4-ai-timeout.png`.
- **Decision:** **Pass.**

### TC-14 Failure — database down
- **Action:** stop PostgreSQL. Call `/api/health` and `/api/products`, and open the home page.
- **Expected:** products page shows an error; health should reveal the outage.
- **Observed:**
  - Page: "The server could not complete the request." (`F5-db-down-products.png`).
  - **But `/api/health` → `200 {"status":"ok"}`.**
  - The 500 body exposed Prisma's internal code: `{"code":"P1001",…}`.
- **Decision:** **Fail → DEF-2 and DEF-3.**
- **After fix:**
  - health → `503 {"status":"error","database":"unreachable"}`, and back to `200` when the DB restarts
  - products → `500 {"code":"INTERNAL_ERROR",…}`
  - **Pass after fix.**

### TC-15 API — malformed JSON
- **Action:** `POST /api/orders` with body `{"customerName": oops`.
- **Expected:** 400 with a clear client-error code.
- **Observed:** `400 {"code":"INTERNAL_ERROR","message":"Unexpected token 'o', ...\"merName\": oops\" is not valid JSON"}`. It is labelled as a server error, echoes the request body, and has no traceId.
- **Decision:** **Fail → DEF-3.**
- **After fix:** `400 {"code":"INVALID_JSON","message":"Request body must be valid JSON.","traceId":"…"}`. **Pass after fix.**

### TC-16 CORS / data exposure
- **CORS:** a request with `Origin: https://evil.example` received `Access-Control-Allow-Origin: http://localhost:5173`, so the browser blocks it. **Pass.**
- **Data exposure:** `GET /api/orders`, `GET /api/orders/1` → `404 ROUTE_NOT_FOUND`. No endpoint returns customer data. The assistant loads only public product fields. **Pass.**

### Summary

| Result | Cases |
| --- | --- |
| Pass at baseline | 12 (TC-01–03, 05–11, 13, 16) |
| Failed, then fixed and re-verified | 4 (TC-04, TC-12, TC-14, TC-15) |
| Blocked | 0 |

---

## 3. Defects (reproductions)

### DEF-1 (High): no request timeout, so checkout can hang forever
- **Starting state:** item in cart, checkout form filled.
- **Action:** API accepts the connection but never responds; click *Place simulated order*.
- **Actual:** "Submitting order…" indefinitely. The product list and details stay on "Loading…" too.
- **Expected:** loading ends with a useful message.
- **Cause:** `frontend/src/services/api.js` passed no `AbortSignal` except for the assistant.

### DEF-2 (Medium): health reports ok while the database is down
- **Starting state:** API running.
- **Action:** stop PostgreSQL; `GET /api/health`.
- **Actual:** `200 {"status":"ok"}`.
- **Expected:** a non-200 status, so deployment checks and the platform health probe catch it.
- **Cause:** the route returned a constant.

### DEF-3 (Medium): error responses leak internals and mislabel client errors
- **Action:** DB down → any product request; or send malformed JSON.
- **Actual:** the 500 body carries Prisma's `P1001`. Malformed JSON returns `400 INTERNAL_ERROR` with parser text that echoes the body, and no traceId.
- **Expected:** `INTERNAL_ERROR` with a generic message for server faults; `400 INVALID_JSON` for bad bodies; a traceId on both.
- **Cause:** the error handler used `error.code` for every error, and the request-id middleware ran after `express.json()`.

### DEF-4 (Low): search wildcards return the whole catalog
- **Action:** search `%` or `_`.
- **Actual:** 6 products.
- **Expected:** 0 products.
- **Cause:** Prisma `contains` → SQL `ILIKE '%…%'`, and the user text was not escaped.

---

## 4. Activity 3 — Fixes and verification

| Defect | Smallest fix | Regression test added | Re-test |
| --- | --- | --- | --- |
| DEF-1 | `api.js`: every request gets `AbortSignal.timeout` (15 s default; 35 s for the assistant). Checkout timeout message warns the order may still exist, so the customer won't resubmit blindly. | `frontend/src/services/api.test.js` (4 tests) | TC-12 pass (15.4 s / 15.7 s) |
| DEF-2 | `app.js`: health runs `SELECT 1` through Prisma; 503 `{"status":"error","database":"unreachable"}` on failure. The check is injectable for tests. | `backend/test/app.test.js`: ok + 503 | TC-14 pass |
| DEF-3 | `app.js`: request-id middleware moved before the JSON parser; body-parser errors → `400 INVALID_JSON`; only intentional 4xx errors keep their own code/message; everything else → `500 INTERNAL_ERROR`. | `app.test.js`: malformed JSON + internal code hidden | TC-14, TC-15 pass |
| DEF-4 | `lib/search.js` `escapeLikePattern()` used in `routes/products.js` | `app.test.js`: escaping | TC-04 pass; `keyboard`, `usb`, `USB-C` still correct |

**Tests before the fix:** the new tests failed (red). Frontend: `request is not a function` ×4. Backend: module `lib/search.js` not found.

**After the fix:**
- `npm run check` → **PASS**: frontend 8/8 tests (was 4), backend 36/36 (was 31), lint clean, build ✓. Log: `evidence/03-check-after-fix.txt`.
- The full browser journey was re-run with no regressions: `evidence/03-journey-after-fix.txt`.

**Also done:** `npm audit fix` (non-breaking) updated body-parser 2.3.0→2.4.0, morgan 1.12.0→1.12.1, proxy-addr 2.0.7→2.0.8, qs, ip-address and vite 7.3.6→7.3.8. This cleared the critical/high advisories in the Express runtime chain. `npm run check` re-passed (`evidence/05-final-check.txt`).

No test was deleted or weakened.

---

## 5. Activity 5 — Local release-candidate smoke test

Run 11 Nov 2026 21:32 (UTC+8), sandbox replica, after all fixes. Log: `evidence/05-smoke-test.txt`.

| Check | Result |
| --- | --- |
| Build and tests | `npm run check` exit 0 (8 + 36 tests) |
| Health | `200 {"status":"ok"}` |
| Products | 6 products; home shows 6 cards |
| Cart | add/remove; totals ₱2,750 → ₱1,300 correct |
| Simulated checkout | order #6 created, ₱1,200.00, cart cleared |
| Assistant | keyboard question → Product #2 with source; running shoes → honest no-match |
| Data preserved | orders before = 5 (ids 1–5), after = 7 (ids 1–7); no reseed |

**Team to complete on Windows:** date ______; `npm run check` result ______; screenshots of health, home, cart, order confirmation and assistant attached ☐.

---

## 6. Secrets and privacy checks

| Check | Result |
| --- | --- |
| Fresh `frontend/dist` bundle scanned for `AIza…`, `postgres://`, `DATABASE_URL`, `GEMINI_API_KEY`, `sk-…`, `api_key` | No matches. Only `http://localhost:3000/api` (the public `VITE_API_URL`) is baked in. |
| Existing `frontend/dist/assets/index-f5yIIzvJ.js` in the project folder | No matches |
| Source tree (excluding `.env`) for key-shaped strings | None |
| `.gitignore` | Covers `backend/.env`, `frontend/.env`, `node_modules/`, `dist/` |
| `backend/.env.example` | `GEMINI_API_KEY=` empty |
| `Shop Smart Design notes evidennce final.docx` (text + 3 images) | No secrets. Only mentions "empty GEMINI_API_KEY=". |
| `ShopSmart Grounded Assistant.pdf` (8 pages, text + images reviewed) | No secrets. Page 5's browser screenshot shows personal bookmark names (e.g. personal email shortcuts): crop before submitting. |
| Customer data | Test orders use team members' names (Daniel Jehd, Kian Robe, James Mercado, Igor Toledano), as chosen by the team, plus placeholder names from the first runs (Juan Dela Cruz, Maria Test Santos, Other Test Buyer). No real customers' data. |

Log: `evidence/05-secrets-scan.txt`.

**Submission caution:** the project folder on disk contains real `backend/.env` and `frontend/.env` files, plus `node_modules`. Exclude them from the ZIP (see `RELEASE_NOTE.md`).

---

## 7. Unresolved issues and limitations

| ID | Issue | Impact | Safe temporary limitation |
| --- | --- | --- | --- |
| L-1 | Cart is not persisted; a page refresh empties it | Customer must re-add items after a refresh | Documented. Roadmap Week 2 item. No data loss on the server. |
| L-2 | Cart keeps the stock value from when the item was added | Customer can raise quantity above current stock in the UI | Server refuses with 409 and a clear message (TC-08); cart and orders stay unchanged |
| L-3 | Assistant keyword retrieval has no synonyms ("earphones" ≠ "headset") | Some valid questions get a no-match | Answer is honest and offers browsing; never invents a product |
| L-4 | No authentication, privacy notice or retention policy | Must not collect real personal data | Staging limited to team and instructor; fictional data only |
| L-5 | `trust proxy` not set | Behind a host proxy, the assistant rate limit becomes shared by all users | Set `app.set('trust proxy', 1)` when hosting is approved (deployment plan §6) |
| L-6 | `npm audit` dev-tool advisories (Prisma CLI `deepmerge-ts`, Vitest) | Build/test tooling only | Needs major upgrades (Prisma 7, Vitest 4). Deferred. |
| L-8 | Checkout shows a generic "Check the customer and cart information." instead of naming the bad field | Customer must guess which field to fix | The API already returns `fieldErrors`; show them in `CheckoutPage.jsx` in a later release |
| L-7 | Live Gemini was not called in this test run (no key in the replica) | AI path verified with a stand-in provider and the unit tests; the team's 5 Nov record shows live Gemini working | Re-run TC-09 with the real key on the team machine (`node backend/scripts/checkGemini.js`) |
