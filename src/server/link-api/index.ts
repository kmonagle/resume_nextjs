// Why this file exists: the one place that decides WHICH LinkApi implementation
// this deployment uses, from the LINK_BACKEND environment variable. Nothing
// else in the app knows or cares whether links live in this app's database or
// behind a Go/Java service. Switching is a config change plus a redeploy.
import { getEnv } from "@/server/env";
import { localLinkApi } from "./local";
import { createRemoteLinkApi } from "./remote";
import type { LinkApi } from "./types";

let remote: LinkApi | undefined;

export function getLinkApi(): LinkApi {
  const env = getEnv();
  if (env.LINK_BACKEND === "local") return localLinkApi;

  // env.ts already guaranteed both are set when LINK_BACKEND=remote; the `!`
  // tells TypeScript what the runtime validation established.
  remote ??= createRemoteLinkApi({
    baseUrl: env.LINK_BACKEND_URL!,
    token: env.LINK_BACKEND_TOKEN!,
  });
  return remote;
}
