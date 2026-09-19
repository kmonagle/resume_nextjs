// Why this file exists: lets anyone (the footer, a health check, a contract
// test) ask which implementation is serving the API and which contract version
// it speaks. Handy for proving, in a demo, which backend a deployment runs.
import { getLinkApi } from "@/server/link-api";
import { BackendUnavailableError } from "@/server/link-api/types";
import type { components } from "@/shared/generated/api";

export async function GET() {
  try {
    const { name, contractVersion } = await getLinkApi().getMeta();
    // Typed against the OpenAPI schema: if the contract's Meta shape changes and
    // this does not, the compiler complains.
    const body: components["schemas"]["Meta"] = {
      implementation: name,
      contractVersion,
    };
    // The answer only changes when the app is redeployed (switching LINK_BACKEND
    // means a redeploy), so it is safe to cache briefly. Contrast with
    // GET /api/links, which is per-visitor live data and sends `no-store`.
    return Response.json(body, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
