import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssistantResponse, parseBudget, rankProducts, selectCatalogFacts, toCatalogFact } from '../src/services/assistant.js';
import { seeded } from './fixtures/catalog.js';

const products = [
  { id: 1, name: 'Keyboard', category: 'Accessories', description: 'Mechanical keyboard', price: 1800, stock: 2 },
  { id: 2, name: 'Mouse', category: 'Accessories', description: 'Wireless mouse', price: 600, stock: 3 }
];

test('parseBudget extracts a peso budget', () => assert.equal(parseBudget('below ₱2,000'), 2000));
test('parseBudget understands PHP and pesos', () => {
  assert.equal(parseBudget('keyboard under PHP 1500'), 1500);
  assert.equal(parseBudget('a lamp for 1000 pesos'), 1000);
});
test('parseBudget ignores numbers that are not prices', () => {
  assert.equal(parseBudget('Do you have a 1080p webcam?'), null);
  assert.equal(parseBudget('laptop stand for 16 inch laptop'), null);
});
test('rankProducts respects the budget', () => assert.deepEqual(rankProducts(products, 'mouse below 700').map((p) => p.id), [2]));
test('assistant response contains traceable sources', () => assert.equal(buildAssistantResponse(products, 'keyboard').sources[0].id, 1));

test('keyboard below ₱2,000 selects only the seeded keyboard', () => {
  const facts = selectCatalogFacts(seeded, 'Which keyboard is below ₱2,000?');
  assert.deepEqual(facts.map((f) => f.id), [12]);
  assert.equal(facts[0].price, 1850);
  assert.equal(typeof facts[0].price, 'number');
});

test('a category absent from the catalog selects nothing', () => {
  assert.deepEqual(selectCatalogFacts(seeded, 'Do you sell running shoes?'), []);
});

test('a budget below every price selects nothing', () => {
  assert.deepEqual(selectCatalogFacts(seeded, 'keyboard below ₱500'), []);
});

test('out-of-stock and inactive products are never selected', () => {
  const catalog = [
    ...seeded,
    { id: 90, name: 'Test Keyboard Zero', description: 'Disposable test keyboard', category: 'Accessories', price: 999, stock: 0, active: true },
    { id: 91, name: 'Hidden Keyboard', description: 'Inactive keyboard', category: 'Accessories', price: 999, stock: 5, active: false }
  ];
  const ids = selectCatalogFacts(catalog, 'keyboard').map((f) => f.id);
  assert.ok(!ids.includes(90));
  assert.ok(!ids.includes(91));
});

test('toCatalogFact sends only public fields with a numeric price', () => {
  const fact = toCatalogFact({ ...seeded[1], createdAt: new Date(), orderItems: [] });
  assert.deepEqual(Object.keys(fact).sort(), ['category', 'description', 'id', 'name', 'price', 'stock']);
  assert.equal(fact.price, 1850);
});
