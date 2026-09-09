import { z } from "zod";
import { setLinkActive } from "@/server/repositories/link-repository";
import { updateLinkSchema } from "@/shared/schemas/link-schema";

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/links/[id]">,
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateLinkSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const link = await setLinkActive(id, parsed.data.isActive);

  if (!link) {
    return new Response("Link not found", { status: 404 });
  }
  return Response.json(link);
}
