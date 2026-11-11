// DEF-4 fix: Prisma `contains` becomes SQL ILIKE, where % and _ are wildcards.
// Escaping them makes a search for "%" look for a literal percent sign instead of matching everything.
export function escapeLikePattern(text) {
  return String(text).replace(/[\\%_]/g, '\\$&');
}
