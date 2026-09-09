import { z } from "zod";
import { generateUniqueLink } from "@/server/services/link-service";
import { createLinkSchema } from "@/shared/schemas/link-schema";
import { findAllLinks } from "@/server/repositories/link-repository";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createLinkSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const link = await generateUniqueLink(
    parsed.data.targetUrl,
    parsed.data.title,
  );
  return Response.json(link, { status: 201 });
}

export async function GET() {
  const links = await findAllLinks();
  return Response.json(links);
}
