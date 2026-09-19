// Why this file exists: configures the fast unit tests (`npm test`). They run
// in-process with no server or database. The slower HTTP contract suite has its
// own config (vitest.contract.config.mts) so the two never run by accident together.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path alias from tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: { include: ["src/**/*.test.ts"] },
});
