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
                                        └────► remote adapter ──► Go (Java / C# / Python later) ──► same Postgres
```

- **`LinkApi`** (`src/server/link-api/types.ts`) is the seam. Server Actions and
  route handlers depend on it, never on a database. `LINK_BACKEND=local|remote`
  picks the implementation at deploy time. `remote` calls a backend over HTTP
  (`LINK_BACKEND_URL`, authenticated with `LINK_BACKEND_TOKEN`); the Go service in
  the sibling `resume_go` repo is the first one. Short links stay on this app's
  domain: `/r/{code}` calls the backend's redirect and passes its `Location` on.
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

## Free-tier cold starts

On Render's free plan a service sleeps after 15 idle minutes and takes from about ten seconds to a
minute to wake (measured on Render: Go and C# about 12 s, Python about 22 s; the JVM is the slowest).

**Only a public request wakes a sleeping service.** A request from this Next.js service to a sleeping
backend (both on Render) gets Render's HTML `502` page straight away and does **not** wake it, whereas
the same request from a browser or `curl` is held until the service is up. So to demo a backend on the
free tier, wake it first by opening `https://<backend>/meta` (or `curl` it), then use the site. (An
earlier design pinged the backend from a Next.js startup hook so the two would wake together; it was
removed because server-to-server requests don't wake the service.)

While the backend is asleep the UI degrades politely instead of crashing:

- The JSON API answers `503`, short links answer `503` with `Retry-After`, and the create form and
  toggle show a "try again in a moment" message in amber, not red.
- The dashboard waits at most 6 seconds for the first list of links (`src/server/with-timeout.ts`),
  then renders the table in an amber "Waking the backend…" state, and the browser keeps polling until
  the backend answers.
- The footer's "Served by" line is fetched by the browser after load, so a sleeping backend never delays
  a page render.
- **Don't try to keep everything awake.** A free workspace gets about 750 instance-hours a month; one
  always-on service uses about 730.
- The default `LINK_BACKEND=local` needs no second service at all.

## Continuous integration

`.github/workflows/ci.yml` has two jobs:

- **`test`**: lint, types, unit tests, build (which applies the migrations), and the
  contract suite against this app running on its own (`LINK_BACKEND=local`).
- **`remote`**: runs once per backend in a matrix (Go, Python, C#, Java). It starts a throwaway
  Postgres, builds and starts that backend's Docker image from its repo, starts this
  app with `LINK_BACKEND=remote` pointed at it, checks `/api/meta` names the backend
  (so a run can't pass by silently staying in local mode), and runs the same contract
  suite. Each backend's own CI proves it passes the contract when called directly;
  this job proves the path the live site uses: browser → this app → backend. Adding a
  backend is one line in the matrix. Backends are checked out at `main`, so a breaking
  change over there shows up here; pin a `ref` to freeze one.

## Status and next steps

Done: the `local` and `remote` implementations, the contract, and tests. The same
contract suite passes against the standalone app, against the Go, Python, C# and Java services
directly, and against this app in `remote` mode in front of each of them (all in CI).
Next: more backends, which each need only their own repo and one matrix line here. See `REVIEW.md` for the code review and open items.
