# ShopSmart Grounded Assistant: Test Record

Date tested: 5 November 2026
Automated: `npm run check` (lint, 31 backend tests, frontend tests, build). Result: **passed**. Frontend and backend lint clean, 4 frontend tests and 31 backend tests passed (0 failed), production build succeeded. The "use client" lines from react-router are harmless bundler warnings. See screenshots/07-npm-check-1..3.png

| # | Case | Action | Expected | Observed | Pass? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Catalog match | Asked "Which keyboard cost below 2,000?" | Real in-stock keyboard linked, price matches DB | Only Compact Mechanical Keyboard (id 2), ₱1,850.00, 8 in stock; Sources (1) = Product #2; "Drafted by AI, verified against the catalog." AI added only "hot-swappable tactile switches", which is in the product description. | Pass | screenshots/02-catalog-match.png |
| 2 | No match | Asked "Do you sell running shoes?" | Honest no-match, no invented product/source | "I could not find an in-stock ShopSmart product matching that request…"; 0 links; Sources (0); Gemini not called ("Built from catalog rules") | Pass | screenshots/03-no-match.png |
| 3 | Invalid input | `POST /api/assistant/questions` with `{"question":"hi"}` (PowerShell) | HTTP 422 with existing validation error | `HTTP 422` `{"error":{"code":"INVALID_QUESTION","message":"Question must contain between 3 and 300 characters."}}` | Pass | terminal output |
| 4 | Availability | Set keyboard stock to 0 in Prisma Studio, asked the keyboard question | Not recommended as available; restore data | "I could not find an in-stock ShopSmart product matching that request within ₱2,000.00"; no link; Sources (0). Stock restored to 8 afterwards. | Pass | screenshots/04-availability-stock-0.png, 04-availability-answer.png |
| 5 | Provider failure | Set `GEMINI_API_BASE_URL=http://127.0.0.1:9`, restarted, asked the keyboard question | No endless loading; clear message or rule fallback | Answer appeared quickly with notice "The AI service is unavailable, so this answer was built directly from catalog rules."; keyboard ₱1,850.00, 8 in stock; Sources (1). Setting removed afterwards. | Pass | screenshots/05-provider-failure.png |
| 6 | Source check | Clicked recommended link and Sources link; opened `/api/products/2` | Each points to the selected product record | Both open Compact Mechanical Keyboard: ₱1,850.00, "8 unit(s) available", matching the answer and source id 2 | Pass | screenshots/06-source-check.png, 06-source-check-api.png |

Extra failures observed during development (all handled by the fallback):
- HTTP 404 from Gemini: `gemini-2.5-flash` no longer available to new users. Fixed by setting `GEMINI_MODEL=gemini-3.8-flash`.
- Timeout ("The AI service took too long"): Gemini 3 thinking exceeded 15 s. Fixed with `GEMINI_THINKING_LEVEL=low` and a 25 s limit.

Unit tests covering these cases: `backend/test/assistant.test.js` and `backend/test/groundedAssistant.test.js`.
