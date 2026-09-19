// Why this file exists: implementation #1 of the LinkApi contract, backed by
// this app's own Drizzle repository. It owns the business rules that every
// backend has to reproduce: size limits, short-code generation, housekeeping,
// and how the redirect decides 404 vs 410. The contract tests hold every
// implementation, this one included, to the same behaviour.
import { randomInt } from "node:crypto";

import {
  claimClick,
  countAllLinks,
  countLinksByOwner,
  deleteLinksCreatedBefore,
  findByShortCode,
  findLinksByOwner,
  insertClickEvent,
  insertLink,
  setLinkActive,
} from "@/server/repositories/link-repository";
import {
  LINK_RETENTION_DAYS,
  MAX_LINKS_PER_OWNER,
  MAX_LINKS_TOTAL,
} from "@/shared/lib/demo-limits";
import { getLinkStatus } from "@/shared/lib/link-status";
import { LOCAL_IMPLEMENTATION } from "./implementation";
import type { LinkApi } from "./types";

const GONE_MESSAGES = {
  expired: "This link has expired.",
  max_clicks: "This link has reached its click limit.",
  disabled: "This link has been deactivated.",
} as const;

// A public demo needs guard rails. They are deliberately simple: a couple of
// COUNT queries, no Redis and no rate-limiter service.

const CODE_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const CODE_LENGTH = 7;
const MAX_CODE_ATTEMPTS = 5;

// crypto.randomInt is unbiased and unpredictable. The old Math.random()
// version was guessable and could return fewer than 6 characters (when the
// random number's base-36 form is short).
function generateShortCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export const localLinkApi: LinkApi = {
  getMeta: async () => LOCAL_IMPLEMENTATION,

  async createLink(ownerId, input) {
    // Lazy cleanup instead of a cron job: whoever creates a link also sweeps
    // expired demo data. Cheap thanks to the created_at index.
    const cutoff = new Date(Date.now() - LINK_RETENTION_DAYS * 86_400_000);
    await deleteLinksCreatedBefore(cutoff);

    // Soft limits: count-then-insert can be overshot by a burst of concurrent
    // requests. Acceptable for abuse control (unlike max-clicks, where the
    // limit is a correctness guarantee and is enforced atomically in SQL).
    if ((await countLinksByOwner(ownerId)) >= MAX_LINKS_PER_OWNER) {
      return {
        status: "limit_reached",
        message: `Demo limit: ${MAX_LINKS_PER_OWNER} links per visitor.`,
      };
    }
    if ((await countAllLinks()) >= MAX_LINKS_TOTAL) {
      return {
        status: "limit_reached",
        message: "Demo limit: the service is full right now.",
      };
    }

    const base = {
      ownerId,
      targetUrl: input.targetUrl,
      title: input.title,
      expiresAt: input.expiresAt,
      maxClicks: input.maxClicks,
    };

    // A custom code either works or is "taken"; retrying would not help.
    if (input.shortCode) {
      const link = await insertLink({ ...base, shortCode: input.shortCode });
      return link ? { status: "created", link } : { status: "code_taken" };
    }

    // A generated code that collides is just bad luck: try a fresh one.
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const link = await insertLink({ ...base, shortCode: generateShortCode() });
      if (link) return { status: "created", link };
    }
    throw new Error("Could not generate a unique short code");
  },

  listLinks: (ownerId) => findLinksByOwner(ownerId),

  async setLinkActive(ownerId, id, isActive) {
    return (await setLinkActive(ownerId, id, isActive)) ?? null;
  },

  async followLink(shortCode, meta) {
    const claimed = await claimClick(shortCode);
    if (claimed) {
      return {
        status: "ok",
        targetUrl: claimed.targetUrl,
        afterResponse: () => insertClickEvent(claimed.id, meta),
      };
    }

    // Nothing was claimed: either no such link (404) or it exists but is not
    // redeemable (410). This lookup is safe to be non-atomic because it only
    // chooses the error message; the decision itself was made atomically above.
    const link = await findByShortCode(shortCode);
    if (!link) return { status: "not_found" };

    const status = getLinkStatus(link);
    // "active" here means the link changed between the two statements (for
    // example it was re-enabled). Report it as unavailable rather than guess.
    return { status: "gone", message: GONE_MESSAGES[status === "active" ? "disabled" : status] };
  },
};
