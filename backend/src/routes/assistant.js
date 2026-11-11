import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { answerQuestion } from '../services/groundedAssistant.js';
import { assistantQuestionSchema } from '../validators/schemas.js';
const router = Router();

const assistantLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_QUESTIONS', message: 'Too many questions. Please wait a minute and try again.' } }
});

router.post('/questions', assistantLimiter, async (request, response, next) => {
  try {
    const parsed = assistantQuestionSchema.safeParse(request.body);
    if (!parsed.success) return response.status(422).json({ error: { code: 'INVALID_QUESTION', message: 'Question must contain between 3 and 300 characters.' } });

    // Public catalog fields only. Orders, customers and other private records are never loaded here.
    const products = await prisma.product.findMany({
      where: { active: true, stock: { gt: 0 } },
      select: { id: true, name: true, description: true, category: true, price: true, stock: true, active: true },
      orderBy: { price: 'asc' }
    });

    const result = await answerQuestion(products, parsed.data.question, {
      log: (message) => console.warn(`[${request.id}] ${message}`)
    });
    response.json(result);
  } catch (error) { next(error); }
});

export default router;
