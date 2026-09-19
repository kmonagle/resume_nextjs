// Why this file exists: the one shared Drizzle `db` object. Only repositories
// (src/server/repositories) should import it, so SQL never leaks into routes,
// components or services. See client.md for the long-form explanation.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "../env";
import * as schema from "./schema";

// Next's dev server hot-reloads modules without restarting the Node process.
// Without this, every save would run this file again and open a NEW connection
// pool, leaking the old one until Postgres runs out of connections.
// `globalThis` survives hot reloads, so we stash the pool there.
const globalForDb = globalThis as unknown as {
  conn?: ReturnType<typeof postgres>;
};

const conn =
  globalForDb.conn ??
  postgres(getEnv().DATABASE_URL, {
    // Neon's pooled URL goes through PgBouncer in transaction mode, which does
    // not support named prepared statements; postgres.js uses them by default
    // and would fail intermittently ("prepared statement does not exist").
    prepare: false,
    // Several services (Next + each backend) share one database, so keep each
    // pool small.
    max: 5,
  });

// Only stash in dev: production starts once and never hot-reloads.
if (process.env.NODE_ENV !== "production") {
  globalForDb.conn = conn;
}

// Passing `schema` is what enables the relational query API (db.query.links...).
export const db = drizzle(conn, { schema });
