/**
 * Pagination bounds for GET /api/me/activities.
 *
 * They live beside the route rather than in it because Next.js only permits a
 * route module to export its handlers (`export const MAX_LIMIT` there fails the
 * generated route type check), and tests assert on the cap directly.
 */
export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 500;
