// Why this file exists: one place that reads and validates process.env.
// Failing fast with a readable message at first use beats a cryptic connection
// error (or an accidental `undefined` URL) somewhere deep in a request.
//
// Server-only by design: none of these are NEXT_PUBLIC_*, so Next never inlines
// them into the browser bundle. Anything without that prefix stays on the server.
import { z } from "zod";

// This app is a UI + BFF (backend-for-frontend): it holds no data of its own and
// talks to one backend API that implements docs/openapi.yaml (Go, Python, C# or
// Java). Which one is a deployment setting: point LINK_BACKEND_URL at it.
const envSchema = z.object({
  LINK_BACKEND_URL: z.url("LINK_BACKEND_URL must be a full URL"),
  // Shared secret sent to the backend as "Authorization: Bearer <token>". It
  // must match the backend's own LINK_BACKEND_TOKEN.
  LINK_BACKEND_TOKEN: z.string().min(16, "LINK_BACKEND_TOKEN must be at least 16 characters"),
});

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
