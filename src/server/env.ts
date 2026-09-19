// Why this file exists: one place that reads and validates process.env.
// Failing fast with a readable message at first use beats a cryptic connection
// error (or an accidental `undefined` URL) somewhere deep in a request.
//
// Server-only by design: none of these are NEXT_PUBLIC_*, so Next never inlines
// them into the browser bundle. Anything without that prefix stays on the server.
import { z } from "zod";

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    // Which implementation serves the link API. "local" = this app's own
    // Drizzle code; "remote" = an HTTP backend (Go/Java/...) that implements
    // docs/openapi.yaml. It is a deployment setting, not a UI feature.
    LINK_BACKEND: z.enum(["local", "remote"]).default("local"),
    LINK_BACKEND_URL: z.url().optional(),
    LINK_BACKEND_TOKEN: z.string().min(16).optional(),
  })
  .refine(
    (env) =>
      env.LINK_BACKEND !== "remote" ||
      (env.LINK_BACKEND_URL && env.LINK_BACKEND_TOKEN),
    {
      message:
        "LINK_BACKEND=remote requires LINK_BACKEND_URL and LINK_BACKEND_TOKEN",
    },
  );

export type Env = z.infer<typeof envSchema>;

// Exported separately from getEnv() so tests can feed it arbitrary objects.
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `${i.path.join(".") || "env"}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${problems}`);
  }
  return result.data;
}

let cached: Env | undefined;

// Lazy + memoized rather than parsed at import time: `next build` imports
// server modules while collecting pages, and the build environment does not
// necessarily have every runtime variable set.
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
