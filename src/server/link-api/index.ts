// Why this file exists: the one place that decides WHICH LinkApi implementation
// this deployment uses, from the LINK_BACKEND environment variable. Nothing
// else in the app knows or cares whether links live in this app's database or
// behind a Go/Java service. Switching is a config change plus a redeploy.
import { getEnv } from "@/server/env";
import { localLinkApi } from "./local";
import type { LinkApi } from "./types";

export function getLinkApi(): LinkApi {
  const { LINK_BACKEND } = getEnv();
  switch (LINK_BACKEND) {
    case "local":
      return localLinkApi;
    case "remote":
      // Stage 2 (see docs/openapi.yaml): an HTTP adapter that calls
      // LINK_BACKEND_URL with the bearer token and `cache: "no-store"`.
      throw new Error("LINK_BACKEND=remote is not implemented yet");
  }
}
