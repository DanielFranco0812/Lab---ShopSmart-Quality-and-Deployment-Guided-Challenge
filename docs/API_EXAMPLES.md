# ShopSmart API examples

Start the application with `npm run dev`, then send these requests through Bruno or another authorized API client.

## Health check

```http
GET http://localhost:3000/api/health
```

Returns `200 {"status":"ok"}` when the API can query PostgreSQL. Returns `503 {"status":"error","database":"unreachable"}` when it cannot.

## Error responses

| Situation | Status | `error.code` |
| --- | --- | --- |
| Body is not valid JSON | 400 | `INVALID_JSON` |
| Order fails validation | 422 | `INVALID_ORDER` |
| Product missing or inactive | 422 | `PRODUCT_UNAVAILABLE` |
| Quantity above stock | 409 | `INSUFFICIENT_STOCK` |
| Unexpected server fault (database down, etc.) | 500 | `INTERNAL_ERROR` (generic message, `traceId` matches the `X-Request-ID` header and the server log) |

## Product list

```http
GET http://localhost:3000/api/products
```

## One product

```http
GET http://localhost:3000/api/products/1
```

## Create a simulated order

```http
POST http://localhost:3000/api/orders
Content-Type: application/json

{
  "customerName": "Ana Reyes",
  "email": "ana@example.com",
  "address": "Angeles City, Pampanga",
  "items": [
    { "productId": 1, "quantity": 1 },
    { "productId": 2, "quantity": 1 }
  ]
}
```

The server ignores prices from the browser and reads authoritative prices from PostgreSQL.

## Ask the starter assistant

```http
POST http://localhost:3000/api/assistant/questions
Content-Type: application/json

{
  "question": "Which keyboard is below ₱2,000?"
}
```

The grounded assistant returns:

```json
{
  "answer": "The Compact Mechanical Keyboard costs ₱1,850.00 and has 8 units in stock.",
  "recommendedProducts": [{ "id": 2, "name": "Compact Mechanical Keyboard", "price": 1850, "category": "Accessories", "stock": 8 }],
  "sources": [{ "type": "product", "id": 2, "name": "Compact Mechanical Keyboard", "price": 1850, "stock": 8 }],
  "mode": "ai"
}
```

`mode` is `ai` (verified AI draft), `rules` (fallback, with a `notice`) or `no_match`. A question shorter than 3 characters returns HTTP 422 with code `INVALID_QUESTION`.
