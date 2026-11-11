# ShopSmart Release Note: Release Candidate 1

| | |
| --- | --- |
| **Version and date** | RC1 of ShopSmart (`shopsmart-starter` 1.0.0 + quality fixes), prepared 11 November 2026. Submitted as `ShopSmart-RC1.zip` (fill in the commit hash if submitted from Git: `________`). |
| **Deployment status** | **Local release candidate only.** No hosting or database was approved, so **live staging was not completed**. A staging plan is ready in `DEPLOYMENT_PLAN.md`. |
| **Smoke test** | Local smoke test passed on 11 Nov 2026: health, products, cart, simulated checkout, assistant, and data preserved. Team Windows re-run: date ______ result ______. |
| **Project checks** | `npm run check` passes: lint (frontend + backend), 8 frontend tests, 36 backend tests, production build. |

## Working features (verified customer journeys)

- **Browse and search:** catalog of 6 products with category filter and sort. Search returns relevant results and a "No products match your filters." state. `%` and `_` are now treated literally.
- **Cart:** add, +/−, type a quantity, remove. Quantities are capped at stock and totals stay correct after every action.
- **Simulated checkout:**
  - valid fictional details create exactly one order with a server-calculated total
  - invalid details are refused, in the browser and by the API (422)
  - ordering more than the stock is refused (409); the cart and stock are unchanged
- **Grounded assistant:**
  - answers only with in-stock catalog products and links each to its product page and a source list
  - gives an honest no-match answer without calling the AI
  - Gemini drafts are verified, and unsupported claims are replaced by catalog rules
  - AI outages or timeouts produce a fallback answer with a visible notice
- **Failure handling:**
  - API down, API hanging, database down and AI down all end loading with a useful message
  - checkout warns that a timed-out order may already exist
- **Health:** `GET /api/health` reports ok only when the database answers (503 otherwise).

## Changes in this release

| ID | Change |
| --- | --- |
| DEF-1 | 15 s timeout on every front-end API request (35 s for the assistant), so pages and checkout can no longer load forever |
| DEF-2 | Health endpoint checks PostgreSQL |
| DEF-3 | Error responses no longer expose internal codes (e.g. Prisma `P1001`). Malformed JSON → `400 INVALID_JSON` with a traceId. |
| DEF-4 | Search escapes SQL wildcards |
| Security | `npm audit fix` (non-breaking) updated body-parser, morgan, proxy-addr, qs, ip-address and vite |
| Tests | +4 frontend tests (`api.test.js`), +5 backend tests (`app.test.js`) |
| Docs | README (AI key setup, health, timeouts, migrate deploy), API examples (error codes), test record, deployment plan and diagram |

## Known limitations

- **Authentication:** none. There are no accounts or roles, and no route returns orders or customer data. The app must not collect real personal data; demos and staging use fictional data only.
- **AI:** optional. Without `GEMINI_API_KEY` the assistant uses catalog rules. Keyword retrieval doesn't understand synonyms ("earphones" vs "headset"). Live Gemini was not re-tested in this run; the AI path was verified with unit tests and a stand-in provider.
- **Stock:**
  - The server enforces stock correctly.
  - The cart remembers the stock from when an item was added, so the UI can allow a quantity the server will then refuse, with a clear message.
  - The cart is not persisted, so a page refresh empties it.
- **Hosting:**
  - Not deployed.
  - Before hosting, set Express `trust proxy` so the assistant rate limit works per user (see `DEPLOYMENT_PLAN.md` §6).
  - Free-tier cold starts may need a retry.
- **Dependencies:** remaining `npm audit` advisories are in dev tools (Prisma CLI, Vitest) and need major upgrades.

## Local startup for an evaluator

Follow `README.md` → "Set up the ShopSmart project", steps 1–11.

In short:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed      # first time only: deletes existing orders
npm run check
npm run dev          # frontend http://localhost:5173, API http://localhost:3000/api/health
```

Extra configuration added by the team: optional `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_TIMEOUT_MS` and `GEMINI_THINKING_LEVEL` in `backend/.env`. The app works with the key left empty.

## Team record

Each member names one test they ran, one contribution, and one issue they can explain.

| Member | Test I ran | Contribution | Issue I can explain |
| --- | --- | --- | --- |
| Daniel Jehd Franco | | | |
| | | | |
| | | | |
| | | | |

Suggested issues to split between members (each has a reproduction in `RELEASE_TEST_RECORD.md` §3):
- DEF-1, checkout hanging
- DEF-2, health vs database
- DEF-3, error leakage
- DEF-4, search wildcards
- TC-08, stale-cart stock refusal
- TC-13, AI fallback

## Submission checklist

Include: source, `package-lock.json`, `docs/` (including screenshots and evidence), `README.md`.

Do **not** include:
- `node_modules/` (root, `frontend/`, `backend/`)
- `frontend/dist/`
- `backend/.env` or `frontend/.env`
- any API key or database password
- real customer data

Before zipping, crop personal browser bookmarks out of older screenshots (page 5 of `ShopSmart Grounded Assistant.pdf`).
