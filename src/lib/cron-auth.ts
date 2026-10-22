// Cron endpoints must reject callers unless CRON_SECRET is set and matches.
// Outside production an unset secret is allowed so crons can be run locally.
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
