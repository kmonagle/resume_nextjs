# `schema.ts`

Defines the two Postgres tables this app (and every backend implementation of `docs/openapi.yaml`) uses, as plain TypeScript — this file is the single source of truth for both the database structure and the TypeScript types Drizzle infers from it. There is no separate schema language to learn (unlike Prisma's `.prisma` DSL); `pgTable(...)` calls *are* the schema, and running them through `drizzle-kit` is what turns them into real SQL migrations (see "How migrations work" below).

## Tables

### `links`

One row per short link. Columns and why they exist:

| Column | Type | Purpose |
|---|---|---|
| `id` | `text`, primary key | A UUID (`crypto.randomUUID()`), generated in application code via `$defaultFn`, not by Postgres. |
| `shortCode` | `text`, unique | The code that appears in the short URL (`/r/<shortCode>`). Unique index makes redirect lookups (`WHERE short_code = ?`) fast — this is the hottest read path in the whole app. |
| `targetUrl` | `text` | Where the link redirects to. |
| `title` | `text`, nullable | Optional human label for the dashboard. |
| `createdAt` / `updatedAt` | `timestamp` | `createdAt` is set once via `defaultNow()`. `updatedAt` uses `$onUpdate(() => new Date())` — Drizzle re-runs that function and includes the column in the `SET` clause automatically whenever you call `.update()` on this table, so we never have to remember to bump it by hand. |
| `expiresAt` | `timestamp`, nullable | If set, the link stops working after this time. `null` means "never expires." |
| `maxClicks` | `integer`, nullable | If set, the link stops working once `clickCount` reaches it. `null` means "unlimited." |
| `clickCount` | `integer`, default `0` | **Denormalized** running total of clicks. See "Why `clickCount` is denormalized" below. |
| `isActive` | `boolean`, default `true` | Manual on/off switch. A deactivated link answers `410 Gone`. |
| `ownerId` | `text`, not null | The anonymous visitor (random id in an `httpOnly` cookie) that created the link. Every dashboard read and toggle filters on it. This is scoping for a public demo, **not** authentication. The migration backfills existing rows with the placeholder `legacy` and then drops the default, so nothing can insert a link without an owner. |

Indexes: `links_created_at_idx` on `createdAt` (used by the retention cleanup) and `links_owner_created_idx` on `(ownerId, createdAt)`, which serves the dashboard's "my links, newest first" query without a sort.

### `click_events`

One row per individual click — the append-only event log behind the analytics charts.

| Column | Type | Purpose |
|---|---|---|
| `id` | `text`, primary key | UUID, same pattern as `links.id`. |
| `linkId` | `text`, foreign key → `links.id`, `onDelete: 'cascade'` | Deleting a link deletes its click history automatically — no orphaned rows, no manual cleanup logic needed in the service layer. |
| `occurredAt` | `timestamp` | When the click happened. This is the column analytics queries group by (e.g. "clicks per day"). |
| `referrer` / `userAgent` | `text`, nullable | Captured from the incoming request when available; both can be absent (e.g. someone pastes the link directly into a browser with no referrer). |

Two indexes: `[linkId, occurredAt]` (composite — supports "all clicks for link X, ordered by time," the per-link analytics query) and `[occurredAt]` alone (supports a global "clicks per day across all links" query without filtering by link first).

## Why `clickCount` is denormalized

Strictly speaking, `clickCount` is redundant — it's just `COUNT(*)` of `click_events` for that link. We store it anyway, directly on `links`, for two reasons:

1. **Cap-checking needs to be cheap and atomic.** Every redirect has to check "has this link hit its `maxClicks` limit?" A running counter on the row itself lets that check happen as part of a single guarded `UPDATE` statement (`claimClick` in `link-repository.ts`) — no `COUNT(*)` subquery on the hot path. That one statement checks active/expiry/`maxClicks` *and* increments, so concurrent requests cannot overshoot a limit: Postgres locks the row and the second request re-evaluates the `WHERE` clause against the already-incremented value.
2. **List views need it cheaply too.** The dashboard shows click counts for potentially many links at once; reading an integer column is much cheaper than aggregating `click_events` per row.

The tradeoff: `clickCount` can drift from reality if it's ever updated outside the guarded increment path. We accept that because every write to it goes through one function (`claimClick` in `link-repository.ts`) — there's exactly one place in the codebase allowed to increment it. Any other backend implementation must reproduce that single guarded statement; `contract-tests/` verifies it.

## Relations

`linksRelations` / `clickEventsRelations` (via Drizzle's `relations()` helper) don't create anything in the database — Postgres doesn't know about them. They exist purely so Drizzle's *query API* (`db.query.links.findMany({ with: { clicks: true } })`) can do relational (nested) fetches in application code, similar to what you'd get from an ORM's "include" option elsewhere. The actual relational integrity (the thing that *stops* an orphaned `click_events` row from existing) is the real foreign key + `onDelete: 'cascade'` defined on the column itself.

## How migrations work

`schema.ts` is a description of the *desired* table shape. Turning that into a real Postgres table happens in two steps, both via the `drizzle-kit` CLI (configured in `drizzle.config.ts` at the repo root):

1. `npm run db:generate` — diffs this file against the last known schema state and writes a plain `.sql` migration file into `/drizzle`. You can (and should) read the generated SQL before applying it, and edit it when the generated version would fail on existing data (see `0002_owner_id.sql`, which backfills before enforcing `NOT NULL`).
2. `npm run db:migrate` — runs any pending `.sql` files against the database at `DIRECT_URL`. The `build` script runs this on every deploy.

Because several backend implementations share this schema, **migrations live only in this repo**; backends never migrate.

This two-step split is deliberate: schema changes are reviewable SQL files committed to git, not something applied silently.
