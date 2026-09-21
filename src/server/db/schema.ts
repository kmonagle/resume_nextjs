// Single source of truth for the database shape. Drizzle infers both the SQL
// migrations (via drizzle-kit) and the TypeScript row types from these
// definitions, so the schema is plain TypeScript rather than a separate DSL.
// This app no longer queries the database itself: the schema lives here only to
// generate the SQL migrations (drizzle/) that every backend (Go, Python, C#,
// Java) relies on, so change it deliberately.
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const links = pgTable(
  "links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // The unique constraint doubles as the lookup index for the hot redirect
    // path (WHERE short_code = ?) and as the arbiter for "code already taken".
    shortCode: text("short_code").notNull().unique(),
    targetUrl: text("target_url").notNull(),
    title: text("title"),
    // Anonymous visitor that created the link (random id kept in an httpOnly
    // cookie). Every dashboard read and toggle filters on it. This is scoping
    // for a public demo, NOT authentication: clear the cookie, lose the links.
    ownerId: text("owner_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      // $onUpdate runs in application code on every .update() through Drizzle,
      // so we never have to remember to bump it by hand (raw SQL would skip it).
      .$onUpdate(() => new Date()),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxClicks: integer("max_clicks"),
    clickCount: integer("click_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    index("links_created_at_idx").on(table.createdAt),
    // Serves "my links, newest first" (the dashboard query) without a sort.
    index("links_owner_created_idx").on(table.ownerId, table.createdAt),
  ],
);

export const clickEvents = pgTable(
  "click_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    linkId: text("link_id")
      .notNull()
      // Real foreign key in Postgres: deleting a link deletes its click history,
      // and an orphaned click row cannot exist.
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
  ],
);

// relations() creates nothing in Postgres; it only teaches Drizzle's relational
// query API (db.query.links.findMany({ with: { clicks: true } })) how tables join.
export const linksRelations = relations(links, ({ many }) => ({
  clicks: many(clickEvents),
}));

export const clickEventsRelations = relations(clickEvents, ({ one }) => ({
  link: one(links, {
    fields: [clickEvents.linkId],
    references: [links.id],
  }),
}));

export type Link = typeof links.$inferSelect;
