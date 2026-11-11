import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { prisma } from './lib/prisma.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import assistantRouter from './routes/assistant.js';

const checkDatabaseConnection = () => prisma.$queryRaw`SELECT 1`;

export function createApp({ checkDatabase = checkDatabaseConnection } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
  // Request id first, so even a malformed-JSON error carries a traceId.
  app.use((request, response, next) => { request.id = crypto.randomUUID(); response.setHeader('X-Request-ID', request.id); next(); });
  app.use(express.json({ limit: '100kb' }));
  app.use(morgan(':method :url :status :response-time ms'));

  // DEF-2 fix: health only reports ok when PostgreSQL answers, so a deployment check cannot pass with a dead database.
  app.get('/api/health', async (request, response) => {
    try {
      await checkDatabase();
      response.json({ status: 'ok' });
    } catch (error) {
      console.error(`[${request.id}] health check: database unreachable`, error?.code || '');
      response.status(503).json({ status: 'error', database: 'unreachable' });
    }
  });
  app.use('/api/products', productsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/assistant', assistantRouter);
  app.use((_request, response) => response.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'API route could not be found.' } }));
  // DEF-3 fix: malformed JSON gets its own 400 code, and unexpected errors never expose internal codes such as Prisma's P1001.
  app.use((error, request, response, _next) => {
    if (error?.type === 'entity.parse.failed') {
      return response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.', traceId: request.id } });
    }
    console.error(`[${request.id}]`, error);
    const expected = Number.isInteger(error?.status) && error.status < 500;
    response.status(expected ? error.status : 500).json({ error: {
      code: expected ? (error.code || 'REQUEST_ERROR') : 'INTERNAL_ERROR',
      message: expected ? error.message : 'The server could not complete the request.',
      traceId: request.id
    } });
  });
  return app;
}
