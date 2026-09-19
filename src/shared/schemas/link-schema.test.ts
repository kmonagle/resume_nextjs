// Why this file exists: the schema is the trust boundary for user input. These
// tests cover the security-relevant cases (URL schemes) and the form-specific
// ones (blank fields, code format, expiry).
import { describe, expect, it } from "vitest";

import { createLinkSchema } from "./link-schema";

const ok = { targetUrl: "https://example.com/path" };

describe("createLinkSchema", () => {
  it("accepts a minimal link", () => {
    expect(createLinkSchema.safeParse(ok).success).toBe(true);
  });

  it.each(["javascript:alert(1)", "data:text/html,hi", "ftp://x.com/a", "not a url"])(
    "rejects non-http(s) target %s",
    (targetUrl) => {
      expect(createLinkSchema.safeParse({ targetUrl }).success).toBe(false);
    },
  );

  it("treats blank form fields as absent", () => {
    const parsed = createLinkSchema.safeParse({
      ...ok, title: "", expiresAt: "", maxClicks: "", shortCode: "",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ title: undefined, maxClicks: undefined });
  });

  it("coerces maxClicks from a form string and bounds it", () => {
    expect(createLinkSchema.parse({ ...ok, maxClicks: "5" }).maxClicks).toBe(5);
    expect(createLinkSchema.safeParse({ ...ok, maxClicks: "0" }).success).toBe(false);
    expect(createLinkSchema.safeParse({ ...ok, maxClicks: "1.5" }).success).toBe(false);
    expect(createLinkSchema.safeParse({ ...ok, maxClicks: "2000000" }).success).toBe(false);
  });

  it("validates custom short codes", () => {
    expect(createLinkSchema.safeParse({ ...ok, shortCode: "my-promo_1" }).success).toBe(true);
    expect(createLinkSchema.safeParse({ ...ok, shortCode: "ab" }).success).toBe(false);
    expect(createLinkSchema.safeParse({ ...ok, shortCode: "has space" }).success).toBe(false);
    expect(createLinkSchema.safeParse({ ...ok, shortCode: "a/b/c" }).success).toBe(false);
  });

  it("requires expiresAt to be a future ISO date", () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const past = new Date(Date.now() - 3_600_000).toISOString();
    expect(createLinkSchema.parse({ ...ok, expiresAt: future }).expiresAt).toBeInstanceOf(Date);
    expect(createLinkSchema.safeParse({ ...ok, expiresAt: past }).success).toBe(false);
    expect(createLinkSchema.safeParse({ ...ok, expiresAt: "2030-01-01" }).success).toBe(false);
  });

  it("caps title length", () => {
    expect(createLinkSchema.safeParse({ ...ok, title: "x".repeat(101) }).success).toBe(false);
  });
});
