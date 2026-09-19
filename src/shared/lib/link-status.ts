// Why this file exists: the single definition of "is this link usable, and if
// not, why?". It lives in shared/ (no server-only imports) so the redirect
// path, the API DTO and the dashboard all agree on the answer.
export type LinkStatus = "active" | "expired" | "max_clicks" | "disabled";

type StatusInput = {
  isActive: boolean;
  expiresAt: Date | null;
  maxClicks: number | null;
  clickCount: number;
};

// The order is a contract: disabled beats expired beats max_clicks. The SQL in
// claimClick() applies the same rules; keep them in step.
export function getLinkStatus(
  link: StatusInput,
  now: Date = new Date(),
): LinkStatus {
  if (!link.isActive) return "disabled";
  if (link.expiresAt && link.expiresAt < now) return "expired";
  if (link.maxClicks != null && link.clickCount >= link.maxClicks)
    return "max_clicks";
  return "active";
}
