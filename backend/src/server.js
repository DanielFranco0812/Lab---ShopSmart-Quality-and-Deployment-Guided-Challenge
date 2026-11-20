import 'dotenv/config';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { getSessionSecret } from './lib/auth.js';

// Stop at startup, not at the first sign-in, if production is missing its session secret.
getSessionSecret();
if (process.env.NODE_ENV !== 'production' && !process.env.SESSION_SECRET) console.warn('SESSION_SECRET not set: using a temporary development secret (sign-ins reset when the API restarts).');

const port = Number(process.env.PORT || 3000);
const server = createApp().listen(port, () => console.log(`ShopSmart API running at http://localhost:${port}`));

async function shutdown(signal) {
  console.log(`\n${signal} received. Closing ShopSmart API.`);
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
