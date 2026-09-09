import { db } from "../db/client";
import { links, clickEvents } from "../db/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function findByShortCode(shortCode: string) {
  return db.query.links.findFirst({
    where: eq(links.shortCode, shortCode),
  });
}

export async function createLink(data: {
  shortCode: string;
  targetUrl: string;
  title?: string;
}) {
  const val = await db.insert(links).values(data).returning();
  return val[0];
}

export async function findAllLinks() {
  return db.query.links.findMany({ orderBy: [desc(links.createdAt)] });
}

export async function recordClick(
  linkId: string,
  data: { referrer: string | null; userAgent: string | null },
) {
  await db.transaction(async (tx) => {
    await tx.insert(clickEvents).values({
      linkId,
      referrer: data.referrer,
      userAgent: data.userAgent,
    });
    await tx
      .update(links)
      .set({ clickCount: sql`${links.clickCount} + 1` })
      .where(eq(links.id, linkId));
  });
}

export async function setLinkActive(id: string, isActive: boolean) {
  const result = await db
    .update(links)
    .set({ isActive })
    .where(eq(links.id, id))
    .returning();
  return result[0];
}
