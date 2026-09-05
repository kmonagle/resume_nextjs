import { findByShortCode } from "@/server/repositories/link-repository";
import { redirect, notFound } from "next/navigation";

export async function GET(
  request: Request,
  { params }: RouteContext<"/r/[shortCode]">,
) {
  const { shortCode } = await params;
  const link = await findByShortCode(shortCode);

  if (!link) {
    notFound();
  }
  redirect(link.targetUrl);
}
