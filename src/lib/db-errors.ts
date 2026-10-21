/**
 * Drizzle umota grešku iz `postgres` drivera u DrizzleQueryError, pa se
 * originalni PostgreSQL kod (npr. 23505 za unique constraint) nalazi u `cause`.
 */
export function isUniqueViolation(error: unknown): boolean {
  const candidate = error as {
    code?: string;
    cause?: { code?: string };
  };
  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}
