// Why this file exists: anonymous visitor identity for a login-free public
// demo. Each browser gets a random id in an httpOnly cookie, and every link is
// owned by one. This scopes data (you only see and change your own links); it
// is NOT authentication. Clear the cookie and you lose access. For real users
// you would add a login (Auth.js/OAuth) and use the user id as the owner.
import { cookies } from "next/headers";

const COOKIE_NAME = "visitor_id";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // matches the link retention window

// Cookies are attacker-controlled input: accept only the shape we generate.
const VALID_ID = /^[A-Za-z0-9_-]{1,64}$/;

// Read-only: safe in Server Components. Server Components cannot SET cookies
// (the response headers are already streaming), so the dashboard uses this and
// simply shows an empty list to a browser that has not created a link yet.
export async function readVisitorId(): Promise<string | undefined> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return value && VALID_ID.test(value) ? value : undefined;
}

// Read-or-create: only callable from Server Actions and Route Handlers, the
// two places Next allows cookies to be written.
export async function getOrCreateVisitorId(): Promise<string> {
  const existing = await readVisitorId();
  if (existing) return existing;

  const id = crypto.randomUUID();
  (await cookies()).set(COOKIE_NAME, id, {
    httpOnly: true, // invisible to page JavaScript, so XSS cannot read it
    sameSite: "lax", // not sent on cross-site POSTs (basic CSRF hardening)
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
  return id;
}
