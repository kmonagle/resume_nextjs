// Why this file exists: "which implementation is serving?" answered WITHOUT
// importing any adapter. The root layout's footer and /api/meta need only this
// small fact, and importing the local adapter would drag the database client
// into every page's module graph.
import { getEnv } from "@/server/env";

export type Implementation = { name: string; contractVersion: string };

export const LOCAL_IMPLEMENTATION: Implementation = {
  name: "Next.js + Drizzle",
  contractVersion: "1",
};

export function getImplementation(): Implementation {
  return getEnv().LINK_BACKEND === "local"
    ? LOCAL_IMPLEMENTATION
    : { name: "Remote backend", contractVersion: "1" };
}
