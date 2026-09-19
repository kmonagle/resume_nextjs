// Why this file exists: "which implementation is serving?" answered WITHOUT
// importing any adapter. The root layout only needs this small fact, and
// importing the local adapter would drag the database client into every page's
// module graph.
import { getEnv } from "@/server/env";
import type { Implementation } from "./types";

export const LOCAL_IMPLEMENTATION: Implementation = {
  name: "Next.js + Drizzle",
  contractVersion: "1",
};

// Known instantly only for the local implementation. For a remote backend the
// answer has to be fetched (and the backend may be asleep), so return null and
// let the browser ask /api/meta after the page has loaded, instead of making
// every page render wait on a cold start.
export function getKnownImplementation(): Implementation | null {
  return getEnv().LINK_BACKEND === "local" ? LOCAL_IMPLEMENTATION : null;
}
