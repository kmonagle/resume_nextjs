# Code review

Review of the original app (commit `e8c2b23`), what was changed as part of this
work, and what remains. Ranked by severity. "Fixed" means covered by code and,
where noted, by tests.

## High

1. **No authorisation anywhere.** The dashboard, `POST/GET/PATCH /api/links*` and
   the server actions were public, so any visitor could list, disable and create
   every link. *Addressed for a public demo:* anonymous per-visitor scoping (cookie +
   `owner_id`, enforced in SQL, other owners' ids return 404), per-visitor and global
   caps, 30-day cleanup. This is scoping, **not** authentication; real multi-user
   use needs Auth.js/OAuth. Contract tests cover isolation.
2. **`z.url()` accepts any scheme.** `javascript:` and `data:` targets passed
   validation, and the redirect route would issue them. *Fixed:* http(s) only
   (`link-schema.ts`, unit-tested).
3. **Neon's pooled URL needs `prepare: false`.** PgBouncer in transaction mode
   cannot run the named prepared statements `postgres.js` uses, which fails
   intermittently in production. *Fixed at the time in the Next.js database client; that client has since been
   removed (this app is UI/BFF only) and each backend handles PgBouncer itself.*
4. **`DATABASE_URL!` non-null assertion.** A missing variable became an
   `undefined` URL and a confusing error later. *Fixed:* zod-validated env
   (`src/server/env.ts`), unit-tested; it now validates `LINK_BACKEND_URL` and `LINK_BACKEND_TOKEN`.

## Medium

5. **Short codes were weak and racy.** `Math.random().toString(36).slice(2, 8)`
   is guessable and can return fewer than 6 characters; check-then-insert races
   into a unique-violation 500. *Fixed:* `crypto.randomInt`, fixed length,
   `INSERT … ON CONFLICT DO NOTHING` with bounded retry.
6. **Max-click limits could not be set, and could not have been enforced safely.**
   `maxClicks`/`expiresAt` were read but nothing wrote them, so the feature was
   dead code; and the check (in `resolveLink`) was separated from the increment
   (later, in `after()`), so concurrent hits would overshoot. `schema.md` claimed
   a guarded atomic `UPDATE` that did not exist. *Fixed:* the form and API set
   both fields, and `claimClick` does check + increment in one statement.
   Concurrency-tested (12 parallel hits, limit 2 → exactly 2 redirects).
7. **`request.json()` threw on bad bodies → 500.** *Fixed:* 400 with a body.
8. **Dates broke over JSON.** `GET /api/links` serialised `expiresAt` to a string,
   which `getLinkStatus` would compare against a `Date`. *Fixed:* `LinkDto` with ISO
   strings and a precomputed `status`, typed from the OpenAPI contract.
9. **Live data was static data.** The dashboard was a server render only. *Fixed:*
   polling via TanStack Query with server-rendered `initialData`.

## Open / not changed

- **`GET /api/links` is unbounded** (no pagination). Fine at 20 links per visitor;
  needs cursor pagination for real use.
- **Bots and link-preview crawlers count as clicks**, and `click_events` has no
  retention (it is removed only when its link is).
- **`NEXT_PUBLIC_BASE_URL` is inlined at build time**, so it must exist in Render's
  *build* environment. `window.location.origin` would avoid that.
- **Soft limits can be overshot** by a burst of concurrent creates (count then
  insert). Acceptable for abuse control, unlike the click limit.
- **`build` runs migrations**, coupling deploys to migration success and requiring
  `DIRECT_URL` at build time. Convenient on Render; a separate release step is
  cleaner at scale.
- **Two write paths** (Server Actions and REST routes) do the same job. Kept
  deliberately: the actions serve the UI, the routes serve scripts and the
  contract tests. Both call the same `LinkApi`.
- **Unused dependencies** `recharts` and `next-themes` are still in `package.json`
  (no charts or theme toggle yet); remove them or use them.
- **Four external backends exist (Go, Python, C#, Java).** The remote adapter passes the
  contract suite against each, in CI (the `remote` job), so the browser → Next.js →
  backend path is checked on every push.
- **Not automated: the browser UI.** Live polling, the create form and the toggle
  were checked by hand in a browser (on Render, against both Go and Python), but no
  end-to-end browser test (Playwright, say) runs in CI. The unit tests, the contract
  suite and the CI matrix cover everything up to the HTTP boundary.

## Scaling notes

- Many open dashboards multiply into `viewers × (1 / 5 s)` requests through Next
  and any backend. Options: request coalescing, or a 1–2 s per-owner micro-cache
  in the BFF; or Server-Sent Events instead of polling.
- Sharing one database across services couples them (see README); a production
  system would give each service its own data and talk over the contract.
