// Why this file exists: tells drizzle-kit where the schema lives, where to write
// SQL migrations, and which database to migrate. DIRECT_URL is Neon's
// non-pooled connection: migrations should not go through PgBouncer.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
});
