// Why this file exists: implementation #2 of the LinkApi contract. Instead of
// touching a database, it calls a separate backend (Go today; Java, C# or
// Python later) over HTTP, following docs/openapi.yaml. The rest of the app
// cannot tell which implementation it is using.
//
// Talking to another service adds failure modes the local adapter never had:
// the network can fail, the backend can be asleep (free-tier cold start), and
// it can answer with something the contract does not allow. So this file:
//   - authenticates every call with the shared bearer token,
//   - gives every call a generous timeout,
//   - validates responses with zod instead of trusting them,
//   - turns transport problems into BackendUnavailableError.
import { z } from "zod";

import type { LinkDto } from "@/shared/lib/link-dto";
import {
  BackendUnavailableError,
  type ClickMeta,
  type CreateLinkResult,
  type Implementation,
  type LinkApi,
  type LinkRecord,
} from "./types";

// Render's free tier takes about a minute to wake a sleeping service, so a
// short timeout would turn every cold start into an error.
export const REQUEST_TIMEOUT_MS = 90_000;

// `z.ZodType<LinkDto>` makes the compiler check this schema against the type
// generated from docs/openapi.yaml, so the two cannot drift apart.
const linkSchema: z.ZodType<LinkDto> = z.object({
  id: z.string(),
  shortCode: z.string(),
  targetUrl: z.string(),
  title: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  maxClicks: z.number().nullable(),
  clickCount: z.number(),
  isActive: z.boolean(),
  status: z.enum(["active", "expired", "max_clicks", "disabled"]),
});

const metaSchema = z.object({
  implementation: z.string(),
  contractVersion: z.string(),
});

function toRecord(dto: LinkDto): LinkRecord {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
    expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
  };
}

type Config = { baseUrl: string; token: string };

export function createRemoteLinkApi({ baseUrl, token }: Config): LinkApi {
  const root = baseUrl.replace(/\/+$/, "");

  // The one place that performs HTTP, so timeout, auth and error handling are
  // written once.
  async function call(
    path: string,
    init: RequestInit & { headers?: Record<string, string> } = {},
    { authenticated = true }: { authenticated?: boolean } = {},
  ): Promise<Response> {
    try {
      return await fetch(`${root}${path}`, {
        ...init,
        // Explicit, not a default: this data is live and must never be cached
        // by Next's fetch layer, or the dashboard would show stale counts.
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      });
    } catch (cause) {
      // Network failure or timeout (a timeout surfaces as TimeoutError).
      throw new BackendUnavailableError("The backend did not respond", { cause });
    }
  }

  const asOwner = (ownerId: string, extra: Record<string, string> = {}) => ({
    "X-Owner-Id": ownerId,
    ...extra,
  });

  // An answer the contract does not list for this call, for example 401 (our
  // token is wrong) or 500. Report it as "backend unavailable" and keep the
  // detail in the server log.
  async function unexpected(response: Response, what: string): Promise<never> {
    const body = await response.text().catch(() => "");
    console.error(`Backend ${what} returned ${response.status}: ${body.slice(0, 200)}`);
    throw new BackendUnavailableError(`Backend ${what} failed (${response.status})`);
  }

  async function parse<T>(response: Response, schema: z.ZodType<T>, what: string): Promise<T> {
    const result = schema.safeParse(await response.json().catch(() => undefined));
    if (!result.success) {
      console.error(`Backend ${what} broke the contract:`, z.prettifyError(result.error));
      throw new BackendUnavailableError(`Backend ${what} sent an invalid response`);
    }
    return result.data;
  }

  return {
    async getMeta(): Promise<Implementation> {
      const response = await call("/meta", {}, { authenticated: false });
      if (!response.ok) return unexpected(response, "meta");
      const meta = await parse(response, metaSchema, "meta");
      return { name: `Next.js → ${meta.implementation}`, contractVersion: meta.contractVersion };
    },

    async createLink(ownerId, input): Promise<CreateLinkResult> {
      const response = await call("/links", {
        method: "POST",
        headers: asOwner(ownerId, { "Content-Type": "application/json" }),
        // Dates cross the wire as ISO strings; undefined fields are dropped.
        body: JSON.stringify({ ...input, expiresAt: input.expiresAt?.toISOString() }),
      });

      if (response.status === 201) {
        return { status: "created", link: toRecord(await parse(response, linkSchema, "create")) };
      }
      if (response.status === 409) return { status: "code_taken" };
      if (response.status === 429) {
        const body = await response.json().catch(() => ({}));
        return { status: "limit_reached", message: body.error ?? "Limit reached" };
      }
      // A 400 here means our validation and the backend's disagree: a bug.
      return unexpected(response, "create");
    },

    async listLinks(ownerId) {
      const response = await call("/links", { headers: asOwner(ownerId) });
      if (!response.ok) return unexpected(response, "list");
      return (await parse(response, z.array(linkSchema), "list")).map(toRecord);
    },

    async setLinkActive(ownerId, id, isActive) {
      const response = await call(`/links/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: asOwner(ownerId, { "Content-Type": "application/json" }),
        body: JSON.stringify({ isActive }),
      });
      if (response.status === 404) return null;
      if (!response.ok) return unexpected(response, "update");
      return toRecord(await parse(response, linkSchema, "update"));
    },

    async followLink(shortCode, meta: ClickMeta) {
      const response = await call(
        `/r/${encodeURIComponent(shortCode)}`,
        {
          // Do NOT follow the redirect: we want the Location header itself, to
          // pass on to the visitor's browser. Fetch would otherwise chase the
          // target site and hand us its HTML.
          redirect: "manual",
          // Forward the visitor's own headers, so the backend logs the real
          // referrer and browser, not "Next.js server".
          headers: {
            ...(meta.referrer ? { Referer: meta.referrer } : {}),
            ...(meta.userAgent ? { "User-Agent": meta.userAgent } : {}),
          },
        },
        { authenticated: false }, // the public endpoint needs no token
      );

      if (response.status === 404) return { status: "not_found" as const };
      if (response.status === 410) {
        return { status: "gone" as const, message: await response.text() };
      }
      const location = response.headers.get("location");
      if (response.status === 307 && location) {
        // No afterResponse: the backend already counted the click and logs the
        // event itself. Doing it here too would double count.
        return { status: "ok" as const, targetUrl: location };
      }
      return unexpected(response, "follow");
    },
  };
}
