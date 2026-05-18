export type UserRole = "employee" | "team_lead" | "admin";

export class ForbiddenError extends Error {
  constructor(message = "This area isn't available to you.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Server-side role guard. Throws ForbiddenError if `actual` is not in
 * `allowed`. Use in Server Components, Server Actions, and Route Handlers
 * after fetching the caller's profile.role.
 *
 * The hard authorization boundary is RLS in Postgres — this helper is a
 * UI-routing convenience that keeps the caller from rendering a page they
 * can't pull data for anyway.
 */
export function requireRole(
  actual: UserRole | null | undefined,
  allowed: readonly UserRole[],
): asserts actual is UserRole {
  if (!actual || !allowed.includes(actual)) {
    throw new ForbiddenError();
  }
}
