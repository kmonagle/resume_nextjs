// Why this file exists: enable/disable a single link over JSON. The dashboard
// toggle uses a Server Action instead; this endpoint exists so the same
// operation is reachable (and contract-testable) as plain HTTP.
import { getLinkApi } from "@/server/link-api";
import {
  errorResponse,
  json,
  readJsonBody,
  validationError,
} from "@/server/http";
import { readVisitorId } from "@/server/visitor";
import { toLinkDto } from "@/shared/lib/link-dto";
import { updateLinkSchema } from "@/shared/schemas/link-schema";

// `RouteContext<"/api/links/[id]">` is a typed helper Next generates from the
// file path, so `params.id` is known to exist and be a string.
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/links/[id]">,
) {
  const { id } = await params;

  const raw = await readJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = updateLinkSchema.safeParse(raw.body);
  if (!parsed.success) return validationError(parsed.error);

  const ownerId = await readVisitorId();
  const link = ownerId
    ? await getLinkApi().setLinkActive(ownerId, id, parsed.data.isActive)
    : null;

  // 404, not 403, for someone else's link: do not confirm it exists.
  if (!link) return errorResponse("Link not found", 404);
  return json(toLinkDto(link));
}
