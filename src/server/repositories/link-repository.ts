import { db } from "../db/client";
import { links } from "../db/schema";
import { eq } from "drizzle-orm";

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
