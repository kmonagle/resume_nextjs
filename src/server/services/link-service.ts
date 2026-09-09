import {
  createLink,
  findByShortCode,
} from "@/server/repositories/link-repository";
import type { Link } from "@/server/db/schema";
import { getLinkStatus, type LinkStatus } from "@/shared/lib/link-status";

export type ResolveLinkResult =
  | { status: "ok"; link: Link }
  | { status: "not_found" }
  | { status: "gone"; reason: Exclude<LinkStatus, "active"> };

function generateShortCode(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function generateUniqueLink(targetUrl: string, title?: string) {
  while (true) {
    const newcode = generateShortCode();
    const existing = await findByShortCode(newcode);
    if (!existing) {
      return createLink({ shortCode: newcode, targetUrl, title });
    }
  }
}

export async function resolveLink(
  shortCode: string,
): Promise<ResolveLinkResult> {
  const link = await findByShortCode(shortCode);

  if (!link) {
    return { status: "not_found" };
  }

  const linkStatus = getLinkStatus(link);
  if (linkStatus !== "active") {
    return { status: "gone", reason: linkStatus };
  }

  return { status: "ok", link };
}
