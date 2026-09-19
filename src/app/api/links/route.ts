// Why this file exists: the browser-facing JSON API for links. The dashboard
// polls GET here every few seconds; POST is the same create operation the form
// uses, exposed for scripts and the contract tests. Identity comes from the
// visitor cookie, never from a client-supplied header.
import { getLinkApi } from "@/server/link-api";
import {
  errorResponse,
  json,
  readJsonBody,
  validationError,
} from "@/server/http";
import { getOrCreateVisitorId, readVisitorId } from "@/server/visitor";
import { toLinkDto } from "@/shared/lib/link-dto";
import { createLinkSchema } from "@/shared/schemas/link-schema";

export async function POST(request: Request) {
  const raw = await readJsonBody(request);
  if (!raw.ok) return raw.response;

  const parsed = createLinkSchema.safeParse(raw.body);
  if (!parsed.success) return validationError(parsed.error);

  const ownerId = await getOrCreateVisitorId();
  const result = await getLinkApi().createLink(ownerId, parsed.data);

  switch (result.status) {
    case "created":
      return json(toLinkDto(result.link), 201);
    case "code_taken":
      return errorResponse("That code is already taken", 409);
    case "limit_reached":
      return errorResponse(result.message, 429);
  }
}

export async function GET() {
  // Reading `cookies()` opts this handler out of static prerendering. Without
  // any request-time API, Next would run it once at build and serve that
  // snapshot forever.
  const ownerId = await readVisitorId();
  const links = ownerId ? await getLinkApi().listLinks(ownerId) : [];
  return json(links.map((link) => toLinkDto(link)));
}
