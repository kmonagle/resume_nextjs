import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const links = pgTable(
  "links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shortCode: text("short_code").notNull().unique(),
    targetUrl: text("target_url").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxClicks: integer("max_clicks"),
    clickCount: integer("click_count").notNull().default(0),
  },
  (table) => [index("links_created_at_idx").on(table.createdAt)]
);

export const clickEvents = pgTable(
  "click_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    linkId: text("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("click_events_link_occurred_idx").on(table.linkId, table.occurredAt),
    index("click_events_occurred_idx").on(table.occurredAt),
  ]
);

export const linksRelations = relations(links, ({ many }) => ({
  clicks: many(clickEvents),
}));

export const clickEventsRelations = relations(clickEvents, ({ one }) => ({
  link: one(links, {
    fields: [clickEvents.linkId],
    references: [links.id],
  }),
}));
