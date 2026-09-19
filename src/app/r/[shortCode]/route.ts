// Why this file exists: the public short-link URL (/r/<code>). It is the hot
// path of the whole product: anyone can hit it, no cookie, and it must both
// redirect quickly and count the click correctly.
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";

import { getLinkApi } from "@/server/link-api";

const GONE_MESSAGES = {
  expired: "This link has expired.",
  max_clicks: "This link has reached its click limit.",
  disabled: "This link has been deactivated.",
} as const;

export async function GET(
  request: Request,
  { params }: RouteContext<"/r/[shortCode]">,
) {
  const { shortCode } = await params;

  // Deliberately uncached: every hit must reach the atomic claim in the
  // database, or click limits and counts would be wrong.
  const result = await getLinkApi().followLink(shortCode, {
    referrer: request.headers.get("referer"),
    userAgent: request.headers.get("user-agent"),
  });

  // notFound() and redirect() work by THROWING a special error that Next
  // catches, so code after them never runs (no `return` needed).
  if (result.status === "not_found") notFound();

  // 410 Gone (not 404): the link existed but is permanently unavailable.
  if (result.status === "gone") {
    return new Response(GONE_MESSAGES[result.reason], { status: 410 });
  }

  // after() runs once the response has been sent, so logging the click event
  // does not add latency to the redirect the visitor is waiting for.
  if (result.afterResponse) after(result.afterResponse);

  redirect(result.targetUrl);
}
