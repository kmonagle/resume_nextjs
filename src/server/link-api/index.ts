// Why this file exists: the one place that builds the LinkApi this app uses: the
// HTTP adapter that calls the backend named by LINK_BACKEND_URL. Nothing else in
// the app knows or cares which language the backend is written in. Switching is
// a config change plus a redeploy.
import { getEnv } from "@/server/env";
import { createRemoteLinkApi } from "./remote";
import type { LinkApi } from "./types";

let api: LinkApi | undefined;

export function getLinkApi(): LinkApi {
  const env = getEnv();
  api ??= createRemoteLinkApi({
    baseUrl: env.LINK_BACKEND_URL,
    token: env.LINK_BACKEND_TOKEN,
  });
  return api;
}
