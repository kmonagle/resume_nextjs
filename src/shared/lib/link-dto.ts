// Why this file exists: the wire format for a link. JSON has no Date type, so
// a Date sent over the network arrives as a string, and code that does
// `link.expiresAt < new Date()` silently breaks. Converting once, here, into
// ISO strings plus a precomputed `status` means the server-rendered dashboard,
// GET /api/links and the polling client all handle exactly the same shape.
import type { components } from "@/shared/generated/api";
import { getLinkStatus } from "./link-status";

// Derived from docs/openapi.yaml, so if the contract changes and this mapper
// does not, `tsc` fails. That is the compile-time half of contract enforcement.
export type LinkDto = components["schemas"]["Link"];

type LinkRecord = {
  id: string;
  shortCode: string;
  targetUrl: string;
  title: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  maxClicks: number | null;
  clickCount: number;
  isActive: boolean;
};

export function toLinkDto(link: LinkRecord, now: Date = new Date()): LinkDto {
  return {
    id: link.id,
    shortCode: link.shortCode,
    targetUrl: link.targetUrl,
    title: link.title,
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt?.toISOString() ?? null,
    maxClicks: link.maxClicks,
    clickCount: link.clickCount,
    isActive: link.isActive,
    status: getLinkStatus(link, now),
  };
}
