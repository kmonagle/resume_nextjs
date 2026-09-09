import { recordClick } from "@/server/repositories/link-repository";
import { resolveLink } from "@/server/services/link-service";
import { redirect, notFound } from "next/navigation";
import { after } from "next/server";

export async function GET(
  request: Request,
  { params }: RouteContext<"/r/[shortCode]">,
) {
  const { shortCode } = await params;
  const result = await resolveLink(shortCode);

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "gone") {
    const messages: Record<typeof result.reason, string> = {
      expired: "This link has expired.",
      max_clicks: "This link has reached its click limit.",
      disabled: "This link has been deactivated.",
    };
    return new Response(messages[result.reason], { status: 410 });
  }

  const { link } = result;

  after(() =>
    recordClick(link.id, {
      referrer: request.headers.get("referer"),
      userAgent: request.headers.get("user-agent"),
    }),
  );

  redirect(link.targetUrl);
}
