# Short links — a Next.js URL shortener built around a contract

Create short links, follow them, and watch click counts update live on the
dashboard. The app is a deliberately small vehicle for a larger idea: **the UI
is a thin Next.js front end / BFF, and the thing that stores links is
interchangeable** (today this app's own Drizzle code; later Go, Java, C# or
Python services), held together by an OpenAPI contract and a shared test suite.

Every source file starts with a comment saying why it exists; non-obvious code
carries "why" comments. Read the code with those and you have a guided tour.

## Try it locally

```bash
docker run -d --name links-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=links -p 54329:5432 postgres:17
cp .env.example .env.local   # then set both URLs to postgres://postgres:dev@localhost:54329/links
npm install
npx drizzle-kit migrate      # export DIRECT_URL first, or use `npm run build`, which migrates
npm run dev
```

| Script | What it does |
|---|---|
| `npm test` | Fast unit tests (status rules, DTO, validation, env parsing) |
| `npm run test:contract` | HTTP contract suite against a **running** server (`CONTRACT_BASE_URL`, default `localhost:3000`) |
| `npm run gen:api` | Regenerate TypeScript types from `docs/openapi.yaml` |
| `npm run build` | Applies migrations, then builds |

## Architecture

```
Browser ──► Next.js (UI + BFF) ──► LinkApi ──► local adapter ──► Postgres
                                        └────► (later) remote adapter ──► Go / Java / C# / Python ──► same Postgres
```

- **`LinkApi`** (`src/server/link-api/types.ts`) is the seam. Server Actions and
  route handlers depend on it, never on a database. `LINK_BACKEND=local|remote`
  picks the implementation at deploy time; only `local` exists so far.
- **The contract** is `docs/openapi.yaml`, written first. TypeScript types are
  generated from it (a drift between contract and code fails `tsc`), and
  `contract-tests/` checks what a schema cannot express: atomic click limits
  under concurrency, owner isolation, expiry, conflicts. Any backend, including
  the standalone Next.js one, must pass the same suite unchanged.
- **Layers:** `src/shared` (pure, used by both sides) · `src/server` (server-only:
  env, DB, repository, adapters, actions) · `src/app` (routes) · `src/components`.
  Only `src/server/repositories` writes SQL.
- **One shared Postgres.** Backends share a schema so implementations are
  swappable and links carry across them. In real microservices, sharing a
  database couples services and is usually an anti-pattern; here it is a
  deliberate choice to make the implementations interchangeable. Migrations live
  only in this repo; backends never migrate.

## Decisions worth talking about

**Live counts use polling, not WebSockets.** The dashboard polls `GET /api/links`
every 5 s with TanStack Query. Next route handlers cannot upgrade to WebSocket,
and with more than one instance you would need pub/sub so a click on instance A
reaches sockets on B. Polling is stateless, pauses in hidden tabs (so it does not
keep a scale-to-zero database awake), and is plenty for a counter. The upgrade
path would be Server-Sent Events. The server-rendered page seeds react-query with
`initialData`, so there is no spinner on first paint.

**Click limits are enforced by one atomic SQL statement.** `claimClick` checks
active / not expired / under `maxClicks` *and* increments in a single `UPDATE …
RETURNING`. Postgres locks the row, so N concurrent requests against a limit-2
link yield exactly two redirects, in any language. The contract suite fires 12
in parallel to prove it.

**Caching decisions — deliberately no server-side caching.**
- The data is per-visitor and must be live; a server cache would fight the feature
  and risks leaking one visitor's links to another.
- Every redirect must reach the atomic `UPDATE`, so the redirect path cannot be
  cached; the counter is written on every click.
- The reads are small indexed queries; caching would add invalidation risk for no
  measurable gain.
- The one cache is react-query in the browser (`staleTime` 0, the interval drives
  refreshes; creating a link or toggling one invalidates it). `GET /api/meta`
  sends a short `Cache-Control` because it only changes on redeploy.
- Two cache layers must both be invalidated after a write: Next's server/router
  cache (`revalidatePath`) and react-query's browser cache (`invalidateQueries`).
- When I *would* use Next's cache: shared, rarely-changing or expensive data (a
  public leaderboard, say) with `'use cache'` + `cacheTag` and `revalidateTag` from
  the mutation. `cacheComponents` is off here and nothing opts in.
- Watch-out: a page that reads no request data can be silently prerendered at
  build. `/dashboard` reads the visitor cookie, so it is dynamic (verified in the
  `next build` route table).

**No login, but not a free-for-all.** Each browser gets an anonymous `httpOnly`
cookie and only sees/changes its own links (ownership is enforced in SQL, and
someone else's link id returns 404). That is scoping, not authentication. Also:
http(s)-only targets (`javascript:` is rejected), per-visitor and global caps,
and links are deleted after 30 days. For real users you would add Auth.js/OAuth
and use the user id as owner.

**Backends are public on Render's free tier** (no private networking), so the
BFF will send `Authorization: Bearer $LINK_BACKEND_TOKEN` and backends must
answer 401 without it; otherwise anyone could call one with any `X-Owner-Id`.

## Status and next steps

Done: everything above for the `local` implementation, with the contract and
tests. Next: a `RemoteLinkApi` adapter, a first external backend (Dockerfile;
Render runs Go/Python natively and Java/C# via Docker), then a CI matrix that
runs the same contract suite against every backend. See `REVIEW.md` for the
code review and open items.
