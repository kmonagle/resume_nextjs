// Why this file exists: configures the contract suite (`npm run test:contract`).
// These tests talk HTTP to a RUNNING backend (CONTRACT_BASE_URL) and need a real
// database, so they are separate from the unit tests. Generous timeouts because
// a free-tier backend can take a while to wake up.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["contract-tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
