import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { SESSION_COOKIE, createSessionToken, hashPassword, publicUser, sessionCookieOptions, verifyPassword } from '../lib/auth.js';
import { requireUser } from '../middleware/session.js';
import { loginSchema, registerSchema } from '../validators/schemas.js';
const router = Router();

// Slows down password guessing: at most 10 sign-in or register attempts per minute per visitor.
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Please wait a minute and try again.' } }
});

function startSession(response, user) {
  response.cookie(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions());
}

router.post('/register', authLimiter, async (request, response, next) => {
  try {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return response.status(422).json({ error: { code: 'INVALID_ACCOUNT', message: 'Enter your name, a valid email and a password of at least 8 characters.', details: parsed.error.flatten().fieldErrors } });
    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return response.status(409).json({ error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists. Please sign in.' } });
    const user = await prisma.user.create({ data: { name: parsed.data.name, email, passwordHash: hashPassword(parsed.data.password) } });
    startSession(response, user);
    response.status(201).json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/login', authLimiter, async (request, response, next) => {
  try {
    const parsed = loginSchema.safeParse(request.body);
    const user = parsed.success ? await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } }) : null;
    // Same message for an unknown email and a wrong password, so accounts cannot be discovered by guessing.
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return response.status(401).json({ error: { code: 'INVALID_LOGIN', message: 'Email or password is incorrect.' } });
    }
    startSession(response, user);
    response.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/logout', (_request, response) => {
  const options = sessionCookieOptions();
  delete options.maxAge; // clearCookie sets its own expiry
  response.clearCookie(SESSION_COOKIE, options);
  response.status(204).end();
});

router.get('/me', requireUser(), (request, response) => {
  response.json({ user: publicUser(request.user) });
});

export default router;
