/**
 * Runs once when the Next.js server starts. The Drizzle client is built lazily
 * (src/lib/db.ts), so touch it here to make a missing DATABASE_URL fail at boot
 * instead of surfacing as a 500 on the first request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getDb } = await import('./lib/db');
    getDb();
  }
}
