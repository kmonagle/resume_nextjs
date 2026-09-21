# Short links — one API, four backends, one Next.js UI

## Start here

**One small API, built four times, in four ecosystems.** Create a short link, follow it
(`/r/{code}`), watch its click count, disable it. The interesting part is not the feature; it is
that the same behaviour is delivered by **Go, Python (FastAPI), C# (ASP.NET Core) and Java (Spring
Boot)** services that share one Postgres, and that this **Next.js app is only the UI and a
backend-for-frontend (BFF)**: it holds no data, and which backend it talks to is one setting
(`LINK_BACKEND_URL`).

```
Browser ──► Next.js (UI + BFF) ──► one backend ──► shared Postgres
                                   Go | Python | C# | Java
```

What holds it together is small on purpose:

- **A contract, written first:** [`docs/openapi.yaml`](docs/openapi.yaml). TypeScript types are generated from it.
- **One shared test suite** ([`contract-tests/`](contract-tests)) that every backend must pass
  unchanged, run in each backend's own CI and again through this app in front of each backend.
  It checks what a schema cannot: atomic click limits under concurrency, owner isolation, expiry.
- **Each backend is a normal, idiomatic project for its ecosystem**, with its own README and comments
  that translate every idiom for a TypeScript reader ("JS/TS vs Go", and so on).

| Repo | Framework | Data access | Validation | Concurrency model | Tests | Formatter / lint |
|---|---|---|---|---|---|---|
| [`resume_go`](https://github.com/kmonagle/resume_go) | `net/http` (standard library) | `pgx` + hand-written SQL | by hand, in a validator | a goroutine per request | `go test`, `httptest`, fake store | `gofmt`, `go vet` |
| [`resume_python`](https://github.com/kmonagle/resume_python) | FastAPI | SQLAlchemy 2 (async) | pydantic | one event loop, `async`/`await` | `pytest`, fake store | `ruff` |
| [`resume_csharp`](https://github.com/kmonagle/resume_csharp) | ASP.NET Core minimal APIs | EF Core | hand-written validator | thread pool + `async`/`await` | xUnit, `WebApplicationFactory` | `dotnet format` |
| [`resume_java`](https://github.com/kmonagle/resume_java) | Spring Boot 4 (Java 25) | Spring Data JPA / Hibernate | hand-written validator + sealed results | virtual threads | JUnit, MockMvc | Spotless |

### Same concept, different tool

| Concept | Go | Python | C# | Java |
|---|---|---|---|---|
| Routing | `ServeMux` patterns | decorators on a router | `MapGet` / `MapPost` | `@RestController` annotations |
| Dependency injection | plain constructors | `Depends(...)` | built-in container (`AddScoped`) | Spring beans |
| Config | environment, read once | pydantic settings | options pattern + `ValidateOnStart` | `@ConfigurationProperties` |
| Persistence | `pgx` pool | async session per request | `DbContext` per request | JPA `EntityManager` |
| The atomic click | one guarded `UPDATE … RETURNING` | same, via SQLAlchemy | `ExecuteUpdate` (rows affected) | a `@Modifying` `@Query` (rows affected) |
| Containerising | multi-stage, static binary | slim image + uvicorn | SDK build, runtime image | JDK build, JRE image |

The concepts are the same everywhere (parameterised SQL, an atomic check-and-increment, owner-scoped
queries that answer 404 rather than 403, bearer-token auth, `ON CONFLICT DO NOTHING` inserts). The
tools are what differ, and each backend README says why it made the choices it did.

### Known differences (honest version)

Sending the same 45 requests to all four backends, 29 answered identically and 16 differed. The
differences come from each framework's defaults, not from bugs in the behaviour the contract tests
check. Three clear violations of the spec were **fixed** (a C# number-as-string was accepted; Go's
unknown-short-code 404 was cacheable; Go accepted a non-JSON content type), and each is now a test in
the shared suite. The rest are **documented, not forced to match**, because forcing them would mean
fighting the framework:

| Difference | Go and C# | Python and Java | Where it comes from |
|---|---|---|---|
| A wrong-typed value (`"maxClicks": true`, a number for `targetUrl`) | error under `body` | error under the field name (Python always; Java when creating, not when toggling) | Go and C# fail while decoding the whole body; pydantic validates per field |
| Wording of a malformed-JSON message | "Body must be valid JSON…" (also Java) | pydantic's own message (Python) | messages are not part of the contract |
| Property names with the wrong case (`TargetUrl`) | accepted | rejected | `encoding/json` and `System.Text.Json` match names case-insensitively by default |
| No token together with a bad body | 401 (also Java) | 400 (Python) | FastAPI parses the body before the auth check runs |
| Unknown route or wrong method: the body | plain text (Go), empty (C#) | JSON, in two different shapes | the spec only defines the documented routes |

This app's own browser-facing routes under `/api` are a different interface (they read a cookie,
coerce form strings to numbers and let Next answer unknown routes), so the strictness cases in the
suite run against the four backends only; the rest of the suite runs through this app too.

The backends share one contract in this repo, so a contract change turns each backend's CI red until
it is updated (their CI checks out the contract at `main`). That is a deliberate simplification for a
one-owner project; with several teams you would version it.

## Try it locally

```bash
# 1. A database, and the schema (any backend repo can run against it)
docker run -d --name links-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=links -p 54329:5432 postgres:17
DIRECT_URL=postgres://postgres:dev@localhost:54329/links npx drizzle-kit migrate
# 2. Start one backend (see its README), e.g. resume_go on :8080 with the same
#    DATABASE_URL and LINK_BACKEND_TOKEN.
# 3. Point this app at it and run
cp .env.example .env.local   # set LINK_BACKEND_URL (e.g. http://localhost:8080) and LINK_BACKEND_TOKEN
npm install
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
Browser ──► Next.js (UI + BFF) ──► LinkApi (HTTP adapter) ──► one backend ──► shared Postgres
                                                               (Go | Python | C# | Java)
```

- **`LinkApi`** (`src/server/link-api/types.ts`) is the seam. Server Actions and
  route handlers depend on it, never on a database. The adapter calls a backend
  over HTTP (`LINK_BACKEND_URL`, authenticated with `LINK_BACKEND_TOKEN`), so
  switching backends is a setting plus a redeploy. Short links stay on this app's
  domain: `/r/{code}` calls the backend's redirect and passes its `Location` on.
- **The contract** is `docs/openapi.yaml`, written first. TypeScript types are
  generated from it (a drift between contract and code fails `tsc`), and
  `contract-tests/` checks what a schema cannot express: atomic click limits
  under concurrency, owner isolation, expiry, conflicts. Every backend must pass
  the same suite unchanged.
- **Layers:** `src/shared` (pure, used by both sides) · `src/server` (server-only:
  env, the backend adapter, actions) · `src/app` (routes) · `src/components`.
  This app writes no SQL; only the backends do.
- **One shared Postgres.** Backends share a schema so implementations are
  swappable and links carry across them. In real microservices, sharing a
  database couples services and is usually an anti-pattern; here it is a
  deliberate choice to make the implementations interchangeable. Migrations live
  only in this repo (`drizzle/`, generated from `src/server/db/schema.ts`; `npm run
  build` applies them); backends never migrate. That is a known simplification: a
  larger setup would give the contract and migrations their own repo.

## Decisions worth talking about

**Live counts use polling, not WebSockets.** The dashboard polls `GET /api/links`
every 5 s with TanStack Query. Next route handlers cannot upgrade to WebSocket,
and with more than one instance you would need pub/sub so a click on instance A
reaches sockets on B. Polling is stateless, pauses in hidden tabs (so it does not
keep a scale-to-zero database awake), and is plenty for a counter. The upgrade
path would be Server-Sent Events. The server-rendered page seeds react-query with
`initialData`, so there is no spinner on first paint.

**Click limits are enforced by one atomic SQL statement.** Each backend's claim query checks
active / not expired / under `maxClicks` *and* increments in a single `UPDATE …
RETURNING`. Postgres locks the row, so N concurrent requests against a limit-2
link yield exactly two redirects, in any language. The contract suite fires 12
in parallel to prove it.

**Caching decisions — deliberately no server-side caching.**
- The data is per-visitor and must be live. A server cache would fight the feature,
  and it would have to be keyed per visitor (the URL is the same for everyone; only
  the cookie differs), because getting that wrong would leak one visitor's links to
  another. So we don't add one.
- Every redirect must reach the atomic `UPDATE`, so the redirect path cannot be
  cached; the counter is written on every click.
- The reads are small indexed queries; caching would add invalidation risk for no
  measurable gain.
- No server-side data cache is added. The one cache we manage is react-query in
  the browser (`staleTime` 0, the interval drives refreshes; creating a link or
  toggling one invalidates it). `GET /api/meta` sends a short `Cache-Control`
  because it only changes on redeploy.
- Next also keeps its own browser-side **Client Cache** of rendered pages (used
  mainly for back/forward navigation). After a write we clear both it
  (`revalidatePath`) and react-query's cache (`invalidateQueries`). react-query
  alone would keep the table correct; `revalidatePath` is cheap insurance so a
  stored copy of `/dashboard` can't briefly show stale links.
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

## Continuous integration

`.github/workflows/ci.yml` has two jobs:

- **`test`**: lint, types, unit tests, and build (which applies the migrations).
- **`remote`**: runs once per backend in a matrix (Go, Python, C#, Java). It starts a throwaway
  Postgres, builds and starts that backend's Docker image from its repo, starts this
  app pointed at it, checks `/api/meta` names the backend, and runs the same contract
  suite. Each backend's own CI proves it passes the contract when called directly;
  this job proves the path the live site uses: browser → this app → backend. Adding a
  backend is one line in the matrix. Backends are checked out at `main`, so a breaking
  change over there shows up here.

## Status and next steps

Done: the contract, four backends, and tests. The same contract suite passes against the Go,
Python, C# and Java services directly and against this app in front of each of them (all in CI).
Adding a backend needs only its own repo and one matrix line here. See `REVIEW.md` for the code review and open items.
