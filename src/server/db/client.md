# `client.ts`

Exports a single shared `db` object — the Drizzle query interface every repository imports and uses. Nothing outside `server/repositories/*` should import from this file directly (see the layering rule in the top-level README once it exists).

## The problem this file solves: connection exhaustion during dev

In development, Next.js's dev server hot-reloads modules as you edit files — but it does *not* restart the whole Node process. If this file just did:

```ts
export const db = drizzle(postgres(process.env.DATABASE_URL!));
```

then every single hot reload would re-run this module, open a *brand new* Postgres connection, and leak the old one — since the old connection object is gone but Postgres (or Neon's connection pooler) still thinks it's open. After enough saves during a coding session, you exhaust the database's connection limit and everything starts failing with connection errors that have nothing to do with the code you just changed.

## The fix: stash the connection on `globalThis`

`globalThis` is **not** reset by Next.js's module hot-reloading — it persists across reloads within the same running process. So:

```ts
const globalForDb = globalThis as unknown as { conn?: ReturnType<typeof postgres> };
const conn = globalForDb.conn ?? postgres(process.env.DATABASE_URL!);
if (process.env.NODE_ENV !== "production") {
  globalForDb.conn = conn;
}
export const db = drizzle(conn, { schema });
```

On the *first* load, `globalForDb.conn` is `undefined`, so we create a real connection and stash it. On every subsequent hot reload, `globalForDb.conn` already exists, so we just reuse it — one connection for the lifetime of the dev server process, no matter how many times you save a file.

The `NODE_ENV !== "production"` guard means we only bother with this global-stashing trick in development. In production, each server instance starts once and stays running (no hot-reload cycle), so there's no leak to guard against, and skipping the global assignment is marginally cleaner.

## Why `postgres.js` instead of another driver

Drizzle supports several Postgres drivers (`node-postgres`, `postgres.js`, Neon's own serverless HTTP driver, etc.). We're using `postgres.js` (the `postgres` package) because:

- It's a normal TCP connection pool, which is exactly what a persistent Render server wants (as opposed to Neon's HTTP-based serverless driver, which exists specifically to work around environments — like edge functions — that can't hold a TCP connection open at all; we don't have that constraint here).
- It's the driver Drizzle's own docs treat as the default/recommended choice for `postgresql` projects.

`db` is typed with the full `schema` object passed in (`drizzle(conn, { schema })`), which is what enables Drizzle's relational query API (`db.query.links.findMany({ with: { clicks: true } })`) — without passing `schema` here, you'd only have the lower-level query builder (`db.select().from(links)...`), not the relational one.
