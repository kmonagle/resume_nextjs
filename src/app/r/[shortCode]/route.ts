// Why this file exists: the public short-link URL (/r/<code>). It is the hot
// path of the whole product: anyone can hit it, no cookie, and it must both
// redirect quickly and count the click correctly.
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";

import { getLinkApi } from "@/server/link-api";
import { BackendUnavailableError } from "@/server/link-api/types";

export async function GET(
  request: Request,
  { params }: RouteContext<"/r/[shortCode]">,
) {
  const { shortCode } = await params;

  // Deliberately uncached: every hit must reach the atomic claim in the
  // database, or click limits and counts would be wrong.
  let result;
  try {
    result = await getLinkApi().followLink(shortCode, {
      referrer: request.headers.get("referer"),
      userAgent: request.headers.get("user-agent"),
    });
  } catch (error) {
    // Only this call is guarded: notFound() and redirect() below work by
    // throwing, and must reach Next untouched.
    if (error instanceof BackendUnavailableError) {
      return new Response(
        "The link service is waking up. Please try again in a moment.",
        { status: 503, headers: { "Retry-After": "30" } },
      );
    }
    throw error;
  }

  // notFound() and redirect() work by THROWING a special error that Next
  // catches, so code after them never runs (no `return` needed).
  if (result.status === "not_found") notFound();

  // 410 Gone (not 404): the link existed but is permanently unavailable.
  if (result.status === "gone") {
    return new Response(result.message, { status: 410 });
  }

  // after() runs once the response has been sent, so logging the click event
  // does not add latency to the redirect the visitor is waiting for.
  if (result.afterResponse) after(result.afterResponse);

  redirect(result.targetUrl);
}
