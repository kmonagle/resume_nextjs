// Why this file exists: small helpers so every JSON route answers errors the
// same way (the shapes promised by docs/openapi.yaml) instead of each handler
// improvising its own.
import { z } from "zod";

// Live data must never be served from a cache: browsers, proxies or Next.
const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: { ...NO_STORE, ...headers },
  });
}

export function errorResponse(message: string, status: number) {
  return json({ error: message }, status);
}

export function validationError(error: z.ZodError) {
  return json(
    {
      error: "Validation failed",
      fieldErrors: z.flattenError(error).fieldErrors,
    },
    400,
  );
}

// `request.json()` throws on an empty or malformed body, which would surface as
// a 500. A client sending garbage is the client's mistake: answer 400.
export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, response: errorResponse("Body must be valid JSON", 400) };
  }
}
