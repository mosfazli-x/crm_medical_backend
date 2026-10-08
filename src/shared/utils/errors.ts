/**
 * Detects a PostgreSQL unique-constraint violation (SQLSTATE 23505).
 *
 * The driver surfaces the code either directly or wrapped in `cause` depending on
 * whether the failure came from the pool or from the client, so both are checked.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; cause?: { code?: string } }
  return candidate.code === '23505' || candidate.cause?.code === '23505'
}