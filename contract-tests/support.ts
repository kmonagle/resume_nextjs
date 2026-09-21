// Why this file exists: everything environment-specific about running the
// contract suite lives here, so the tests themselves read the same no matter
// which backend they target.
//
// Env:
//   CONTRACT_BASE_URL   where the backend listens (default http://localhost:3000)
//   CONTRACT_IDENTITY   "cookie" (Next.js's public routes, the default) or
//                       "header" (remote backends: X-Owner-Id + bearer token)
//   CONTRACT_API_PREFIX path prefix for /links and /meta ("/api" for Next.js,
//                       "" for a standalone backend). /r/{code} is never prefixed.
//   CONTRACT_TOKEN      bearer token when CONTRACT_IDENTITY=header
import { randomUUID } from "node:crypto";

const identity = process.env.CONTRACT_IDENTITY ?? "cookie";
const prefix = process.env.CONTRACT_API_PREFIX ?? (identity === "cookie" ? "/api" : "");
export const baseUrl = process.env.CONTRACT_BASE_URL ?? "http://localhost:3000";
const token = process.env.CONTRACT_TOKEN ?? "";

// A fresh owner per test isolates tests from each other and from old data, and
// (being a random UUID) satisfies the 1-64 char identity rule.
export function newOwner(): string {
  return randomUUID();
}

function identityHeaders(owner: string | null): Record<string, string> {
  if (owner === null) return {};
  return identity === "cookie"
    ? { Cookie: `visitor_id=${owner}` }
    : { "X-Owner-Id": owner, Authorization: `Bearer ${token}` };
}

type Options = { owner?: string | null; body?: unknown; method?: string };

export async function api(path: string, { owner = null, body, method }: Options = {}) {
  const response = await fetch(`${baseUrl}${prefix}${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      ...identityHeaders(owner),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

// Public short-link endpoint: no identity, and redirects are NOT followed so we
// can assert on the 307 itself.
export async function follow(code: string) {
  const response = await fetch(`${baseUrl}/r/${code}`, { redirect: "manual" });
  return { status: response.status, location: response.headers.get("location") };
}

export const createLink = (owner: string, body: Record<string, unknown>) =>
  api("/links", { owner, body: { targetUrl: "https://example.com/target", ...body } });

// Whether this run can express "no/invalid credentials". The cookie strategy
// has no credential to get wrong, so the 401 test only applies to header mode.
export const usesBearerToken = identity === "header";
export async function rawWithoutToken() {
  return fetch(`${baseUrl}${prefix}/links`, {
    headers: { "X-Owner-Id": newOwner(), Authorization: "Bearer wrong" },
  });
}

// A POST to /links with full control of the body and Content-Type, for the
// strictness cases the typed `api` helper cannot express (it always sends JSON).
export async function rawCreate(owner: string, body: string, contentType: string) {
  const response = await fetch(`${baseUrl}${prefix}/links`, {
    method: "POST",
    headers: { ...identityHeaders(owner), "Content-Type": contentType },
    body,
  });
  return { status: response.status };
}

// Like `follow`, but also exposes the Cache-Control header of the answer.
export async function followCacheControl(code: string) {
  const response = await fetch(`${baseUrl}/r/${code}`, { redirect: "manual" });
  return { status: response.status, cacheControl: response.headers.get("cache-control") };
}

// The strictness cases below are about the BACKEND interface (bearer token +
// X-Owner-Id), so they only run in header mode. The BFF's browser-facing routes
// are a different interface: they coerce form strings to numbers, do not check
// the content type, and answer unknown short codes with Next's HTML 404 page.
export const isBackendInterface = identity === "header";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
