// Why this file exists: the ONLY module that talks SQL about links. Keeping
// every query here means the rest of the app (adapter, routes, actions) can be
// reasoned about, and swapped for a remote backend, without touching SQL.
import { and, count, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "../db/client";
import { clickEvents, links } from "../db/schema";

export async function findByShortCode(shortCode: string) {
  return db.query.links.findFirst({ where: eq(links.shortCode, shortCode) });
}

export type NewLink = {
  ownerId: string;
  shortCode: string;
  targetUrl: string;
  title?: string;
  expiresAt?: Date;
  maxClicks?: number;
};

// Returns the created link, or undefined when the short code is already taken.
//
// `ON CONFLICT DO NOTHING` lets Postgres arbitrate: two requests racing for the
// same code cannot both win, and neither throws. The naive alternative
// (SELECT to check, then INSERT) has a gap between the two statements in which
// another request can take the code, producing a unique-violation error.
export async function insertLink(data: NewLink) {
  const [created] = await db
    .insert(links)
    .values(data)
    .onConflictDoNothing({ target: links.shortCode })
    .returning();
  return created;
}

export async function findLinksByOwner(ownerId: string) {
  return db.query.links.findMany({
    where: eq(links.ownerId, ownerId),
    orderBy: [desc(links.createdAt)],
  });
}

export async function countLinksByOwner(ownerId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(links)
    .where(eq(links.ownerId, ownerId));
  return row.n;
}

export async function countAllLinks() {
  const [row] = await db.select({ n: count() }).from(links);
  return row.n;
}

// Housekeeping for a public demo. click_events rows go too, via the FK cascade.
export async function deleteLinksCreatedBefore(cutoff: Date) {
  await db.delete(links).where(lt(links.createdAt, cutoff));
}

// Scoped by owner: passing someone else's link id matches zero rows, so the
// caller sees "not found" and can never toggle a link it does not own (IDOR).
export async function setLinkActive(
  ownerId: string,
  id: string,
  isActive: boolean,
) {
  const [updated] = await db
    .update(links)
    .set({ isActive })
    .where(and(eq(links.id, id), eq(links.ownerId, ownerId)))
    .returning();
  return updated;
}

// The heart of the redirect path: check every rule AND count the click in ONE
// statement.
//
// Doing "SELECT, check maxClicks in JavaScript, later UPDATE" would let two
// concurrent requests both read count = 9 of 10, both pass the check, and
// both redirect, ending at 11. In a single UPDATE, Postgres takes a row lock:
// the second request waits, then re-evaluates the WHERE clause against the
// already-incremented row (count = 10) and matches nothing. The database
// enforces the limit no matter how many app instances or languages call it.
//
// Returns undefined when the link is missing or no longer redeemable; the
// caller then does a follow-up lookup to tell 404 from 410.
export async function claimClick(shortCode: string) {
  const [claimed] = await db
    .update(links)
    .set({ clickCount: sql`${links.clickCount} + 1` })
    .where(
      and(
        eq(links.shortCode, shortCode),
        eq(links.isActive, true),
        or(isNull(links.expiresAt), gt(links.expiresAt, sql`now()`)),
        or(isNull(links.maxClicks), lt(links.clickCount, links.maxClicks)),
      ),
    )
    .returning({ id: links.id, targetUrl: links.targetUrl });
  return claimed;
}

// The analytics log. Kept separate from claimClick so it can run after the
// redirect response has been sent (see the redirect route's `after()`).
export async function insertClickEvent(
  linkId: string,
  data: { referrer: string | null; userAgent: string | null },
) {
  await db.insert(clickEvents).values({ linkId, ...data });
}
