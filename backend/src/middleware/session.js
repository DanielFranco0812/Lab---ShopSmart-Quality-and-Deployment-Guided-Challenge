import { prisma } from '../lib/prisma.js';
import { SESSION_COOKIE, parseCookies, readSessionToken } from '../lib/auth.js';

/** Reads the session cookie (if any) and sets request.userId. Never rejects a request by itself. */
export function loadSession(request, _response, next) {
  request.userId = readSessionToken(parseCookies(request.headers.cookie)[SESSION_COOKIE]);
  next();
}

const notSignedIn = (response) => response.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Please sign in first.' } });

/** Allows the request only for a signed-in customer whose account still exists; sets request.user. */
export function requireUser(findUser = (id) => prisma.user.findUnique({ where: { id } })) {
  return async (request, response, next) => {
    try {
      if (!request.userId) return notSignedIn(response);
      const user = await findUser(request.userId);
      if (!user) return notSignedIn(response);
      request.user = user;
      next();
    } catch (error) { next(error); }
  };
}
