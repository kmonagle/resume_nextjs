// Why this file exists: the seam between "what the app needs" and "who does
// it". Actions and route handlers depend on this interface, never on a
// database or a specific backend. The one adapter (remote.ts) implements it by
// calling a Go/Python/C#/Java service that follows docs/openapi.yaml. The UI
// cannot tell which one, which is the point.
import type { CreateLinkInput } from "@/shared/schemas/link-schema";

// Structural, not a database row type: the adapter builds these from JSON.
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
      // Work an adapter may want done AFTER the redirect has been sent. The
      // route hands it to Next's after(). The HTTP adapter's backend does its
      // own bookkeeping (click logging), so today it is always omitted.
      afterResponse?: () => Promise<void>;
    }
  | { status: "not_found" }
  // `message` is the human-readable reason, not a machine code: the contract's
  // 410 response is plain text, so a remote backend can only hand us a message.
  | { status: "gone"; message: string };

export type ClickMeta = { referrer: string | null; userAgent: string | null };

// Thrown when a backend cannot be reached or answers with something the contract
// does not allow (timeout while it wakes up, 5xx, wrong token). Callers catch it
// to show "try again" instead of a crash. Expected outcomes (404, 409, 429...)
// are NOT errors; they come back as values (see the result types above).
export class BackendUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BackendUnavailableError";
  }
}

export type Implementation = { name: string; contractVersion: string };

export interface LinkApi {
  // Async because a remote backend has to be asked (and may be asleep).
  getMeta(): Promise<Implementation>;
  createLink(ownerId: string, input: CreateLinkInput): Promise<CreateLinkResult>;
  listLinks(ownerId: string): Promise<LinkRecord[]>;
  setLinkActive(
    ownerId: string,
    id: string,
    isActive: boolean,
  ): Promise<LinkRecord | null>;
  followLink(shortCode: string, meta: ClickMeta): Promise<FollowResult>;
}
