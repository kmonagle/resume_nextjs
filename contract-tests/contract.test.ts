// Why this file exists: the executable half of docs/openapi.yaml. A schema can
// say what a response looks like; these scenarios check what the schema cannot:
// atomic click limits under concurrency, owner isolation, expiry, and conflict
// handling. Every backend implementation (Next.js, Go, Java, ...) must pass the
// same file unchanged. Point it at one with CONTRACT_BASE_URL.
import { describe, expect, it } from "vitest";

import {
  api,
  createLink,
  follow,
  newOwner,
  rawWithoutToken,
  sleep,
  usesBearerToken,
} from "./support";

describe("GET /meta", () => {
  it("names the implementation and contract version", async () => {
    const { status, body } = await api("/meta");
    expect(status).toBe(200);
    expect(body).toEqual({
      implementation: expect.any(String),
      contractVersion: "1",
    });
  });
});

describe("POST /links", () => {
  it("creates a link with generated code and defaults", async () => {
    const owner = newOwner();
    const { status, body } = await createLink(owner, { title: "Docs" });
    expect(status).toBe(201);
    expect(body).toMatchObject({
      targetUrl: "https://example.com/target",
      title: "Docs",
      clickCount: 0,
      isActive: true,
      status: "active",
      maxClicks: null,
      expiresAt: null,
    });
    expect(body.shortCode).toMatch(/^[A-Za-z0-9]{6,}$/);
  });

  it("honours a custom code and rejects a duplicate with 409", async () => {
    const code = `c-${newOwner().slice(0, 8)}`;
    expect((await createLink(newOwner(), { shortCode: code })).status).toBe(201);
    expect((await createLink(newOwner(), { shortCode: code })).status).toBe(409);
  });

  it.each([
    ["non-http(s) scheme", { targetUrl: "javascript:alert(1)" }],
    ["not a URL", { targetUrl: "nope" }],
    ["bad code", { shortCode: "a b" }],
    ["zero max clicks", { maxClicks: 0 }],
    ["past expiry", { expiresAt: new Date(Date.now() - 60_000).toISOString() }],
    ["overlong title", { title: "x".repeat(101) }],
  ])("rejects %s with 400 and field errors", async (_name, override) => {
    const { status, body } = await createLink(newOwner(), override);
    expect(status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(Object.keys(body.fieldErrors).length).toBeGreaterThan(0);
  });

  it("enforces the per-owner limit with 429", async () => {
    const owner = newOwner();
    // The contract only requires *a* limit; find where it bites.
    let last = 201;
    for (let i = 0; i < 60 && last === 201; i++) {
      last = (await createLink(owner, {})).status;
    }
    expect(last).toBe(429);
  });
});

describe("GET /links", () => {
  it("returns only the owner's links, newest first", async () => {
    const owner = newOwner();
    const first = (await createLink(owner, { title: "first" })).body;
    await sleep(15);
    const second = (await createLink(owner, { title: "second" })).body;
    await createLink(newOwner(), { title: "someone else's" });

    const { status, body } = await api("/links", { owner });
    expect(status).toBe(200);
    expect(body.map((l: { id: string }) => l.id)).toEqual([second.id, first.id]);
  });

  it("returns an empty list for an owner with no links", async () => {
    const { body } = await api("/links", { owner: newOwner() });
    expect(body).toEqual([]);
  });
});

describe("PATCH /links/{id}", () => {
  it("disables and re-enables, reflected in status and redirect", async () => {
    const owner = newOwner();
    const link = (await createLink(owner, {})).body;

    const off = await api(`/links/${link.id}`, { owner, method: "PATCH", body: { isActive: false } });
    expect(off.status).toBe(200);
    expect(off.body).toMatchObject({ isActive: false, status: "disabled" });
    expect((await follow(link.shortCode)).status).toBe(410);

    await api(`/links/${link.id}`, { owner, method: "PATCH", body: { isActive: true } });
    expect((await follow(link.shortCode)).status).toBe(307);
  });

  it("returns 404 for another owner's link and leaves it untouched", async () => {
    const owner = newOwner();
    const link = (await createLink(owner, {})).body;

    const attack = await api(`/links/${link.id}`, {
      owner: newOwner(), method: "PATCH", body: { isActive: false },
    });
    expect(attack.status).toBe(404);
    expect((await follow(link.shortCode)).status).toBe(307);
  });

  it("returns 400 for a malformed body", async () => {
    const owner = newOwner();
    const link = (await createLink(owner, {})).body;
    const { status } = await api(`/links/${link.id}`, {
      owner, method: "PATCH", body: { isActive: "yes" },
    });
    expect(status).toBe(400);
  });
});

describe("GET /r/{code}", () => {
  it("redirects with 307 to the target and counts the click", async () => {
    const owner = newOwner();
    const link = (await createLink(owner, {})).body;

    const hit = await follow(link.shortCode);
    expect(hit.status).toBe(307);
    expect(hit.location).toBe("https://example.com/target");

    const [after] = (await api("/links", { owner })).body;
    expect(after.clickCount).toBe(1);
  });

  it("returns 404 for an unknown code", async () => {
    expect((await follow(`nope-${newOwner()}`)).status).toBe(404);
  });

  it("returns 410 once an expiry has passed", async () => {
    const owner = newOwner();
    const soon = new Date(Date.now() + 1500).toISOString();
    const link = (await createLink(owner, { expiresAt: soon })).body;
    expect((await follow(link.shortCode)).status).toBe(307);
    await sleep(2000);
    expect((await follow(link.shortCode)).status).toBe(410);
    expect((await api("/links", { owner })).body[0].status).toBe("expired");
  });

  it("stops at maxClicks, sequentially", async () => {
    const owner = newOwner();
    const link = (await createLink(owner, { maxClicks: 2 })).body;
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await follow(link.shortCode)).status);
    expect(statuses).toEqual([307, 307, 410, 410]);

    const [after] = (await api("/links", { owner })).body;
    expect(after).toMatchObject({ clickCount: 2, status: "max_clicks" });
  });

  it("never exceeds maxClicks under concurrency", async () => {
    // The whole point of the atomic guarded UPDATE. A check-then-increment
    // implementation lets several of these parallel requests through.
    const owner = newOwner();
    const link = (await createLink(owner, { maxClicks: 2 })).body;

    const results = await Promise.all(
      Array.from({ length: 12 }, () => follow(link.shortCode)),
    );
    const redirected = results.filter((r) => r.status === 307).length;
    const gone = results.filter((r) => r.status === 410).length;
    expect(redirected).toBe(2);
    expect(gone).toBe(10);

    const [after] = (await api("/links", { owner })).body;
    expect(after.clickCount).toBe(2);
  });
});

describe.runIf(usesBearerToken)("authentication (backend-to-backend)", () => {
  it("rejects a wrong bearer token with 401", async () => {
    expect((await rawWithoutToken()).status).toBe(401);
  });
});
