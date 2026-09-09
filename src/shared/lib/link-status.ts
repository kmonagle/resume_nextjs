export type LinkStatus = "active" | "expired" | "max_clicks" | "disabled";

type StatusInput = {
  isActive: boolean;
  expiresAt: Date | null;
  maxClicks: number | null;
  clickCount: number;
};

export function getLinkStatus(link: StatusInput): LinkStatus {
  if (!link.isActive) return "disabled";
  if (link.expiresAt && link.expiresAt < new Date()) return "expired";
  if (link.maxClicks != null && link.clickCount >= link.maxClicks) return "max_clicks";
  return "active";
}
