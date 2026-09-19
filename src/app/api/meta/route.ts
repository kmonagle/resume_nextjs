// Why this file exists: lets anyone (a footer, a health check, a contract test)
// ask which implementation is serving the API and which contract version it
// speaks. Handy for proving, in a demo, which backend a deployment runs.
import { getImplementation } from "@/server/link-api/implementation";
import type { components } from "@/shared/generated/api";

// The answer only changes when the app is redeployed (switching LINK_BACKEND
// means a redeploy), so it is safe for browsers and proxies to cache briefly.
// Contrast with GET /api/links, which is per-visitor live data and sends
// `Cache-Control: no-store`.
export function GET() {
  const { name, contractVersion } = getImplementation();
  // Typed against the OpenAPI schema: if the contract's Meta shape changes and
  // this does not, the compiler complains.
  const body: components["schemas"]["Meta"] = {
    implementation: name,
    contractVersion,
  };
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
