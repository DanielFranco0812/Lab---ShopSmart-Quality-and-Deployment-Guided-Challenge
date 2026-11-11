// Diagnostic: node backend/scripts/checkGemini.js
// Sends one sample request to Gemini and prints the result. Never prints the key.
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { getProviderConfig, requestGeminiDraft } from '../src/services/aiProvider.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const config = getProviderConfig();

console.log('AI_PROVIDER     :', config.provider);
console.log('GEMINI_API_KEY  :', config.apiKey ? `set (${config.apiKey.length} characters)` : 'NOT SET');
console.log('GEMINI_MODEL    :', config.model);
console.log('Base URL        :', config.baseUrl);
console.log('Timeout (ms)    :', config.timeoutMs);
console.log('Thinking level  :', config.thinkingLevel);

const facts = [{ id: 2, name: 'Compact Mechanical Keyboard', description: 'Hot-swappable compact keyboard with tactile switches.', category: 'Accessories', price: 1850, stock: 8 }];
const started = Date.now();
try {
  const draft = await requestGeminiDraft({ question: 'Which keyboard is below ₱2,000?', facts, budget: 2000 }, config);
  console.log(`\nSUCCESS in ${Date.now() - started} ms - Gemini replied with:`, JSON.stringify(draft, null, 2));
} catch (error) {
  console.log(`\nFAILED after ${Date.now() - started} ms (${error.kind || 'error'}): ${error.message}`);
  process.exitCode = 1;
}
