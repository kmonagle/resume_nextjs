// Why this file exists: the seam between "what the app needs" and "who does
// it". Actions and route handlers depend on this interface, never on a
// database or a specific backend. Today one adapter implements it with
// Drizzle (local.ts); later a remote adapter can implement it by calling a
// Go/Java/C#/Python service that follows docs/openapi.yaml. The UI cannot tell
// the difference, which is the point.
import type { CreateLinkInput } from "@/shared/schemas/link-schema";
import type { LinkStatus } from "@/shared/lib/link-status";

// Structural, not a Drizzle row type: a remote adapter builds these from JSON.
export type LinkRecord = {
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

// Expected outcomes are values, not exceptions: the caller must handle each
// case, and the compiler checks that it does.
export type CreateLinkResult =
  | { status: "created"; link: LinkRecord }
  | { status: "code_taken" }
  | { status: "limit_reached"; message: string };

export type FollowResult =
  | {
      status: "ok";
      targetUrl: string;
      // Work the adapter wants done AFTER the redirect has been sent (the
      // local adapter logs the click event here). The route hands it to
      // Next's after(); a remote adapter, whose backend does its own
      // bookkeeping, simply omits it.
      afterResponse?: () => Promise<void>;
    }
  | { status: "not_found" }
  | { status: "gone"; reason: Exclude<LinkStatus, "active"> };

export type ClickMeta = { referrer: string | null; userAgent: string | null };

export interface LinkApi {
  readonly implementation: { name: string; contractVersion: string };
  createLink(ownerId: string, input: CreateLinkInput): Promise<CreateLinkResult>;
  listLinks(ownerId: string): Promise<LinkRecord[]>;
  setLinkActive(
    ownerId: string,
    id: string,
    isActive: boolean,
  ): Promise<LinkRecord | null>;
  followLink(shortCode: string, meta: ClickMeta): Promise<FollowResult>;
}
