// Why this file exists: pins down how the remote adapter maps HTTP answers onto
// the LinkApi contract, and how it fails, using a faked `fetch` so no backend is
// needed. The real end-to-end check is the contract suite run against a
// Next.js server that is pointed at a backend (LINK_BACKEND_URL).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRemoteLinkApi } from "./remote";
import { BackendUnavailableError } from "./types";

const fetchMock = vi.fn();
const api = createRemoteLinkApi({ baseUrl: "https://go.example.com/", token: "secret-token-value" });

const linkDto = {
  id: "id-1",
  shortCode: "abc1234",
  targetUrl: "https://example.com",
  title: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2030-01-01T00:00:00.000Z",
  maxClicks: 5,
  clickCount: 0,
  isActive: true,
  status: "active",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: url as string, init: init as RequestInit & { headers: Record<string, string> } };
};

describe("createLink", () => {
  it("sends auth, owner and an ISO expiry, and returns dates as Date", async () => {
    fetchMock.mockResolvedValue(json(linkDto, 201));
    const result = await api.createLink("owner-1", {
      targetUrl: "https://example.com",
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    });

    const { url, init } = lastCall();
    expect(url).toBe("https://go.example.com/links"); // trailing slash normalised
    expect(init.headers).toMatchObject({
      Authorization: "Bearer secret-token-value",
      "X-Owner-Id": "owner-1",
    });
    expect(init.cache).toBe("no-store");
    expect(JSON.parse(init.body as string).expiresAt).toBe("2030-01-01T00:00:00.000Z");

    expect(result.status).toBe("created");
    if (result.status === "created") {
      expect(result.link.createdAt).toBeInstanceOf(Date);
      expect(result.link.expiresAt).toBeInstanceOf(Date);
    }
  });

  it("maps 409 to code_taken and 429 to limit_reached", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "taken" }, 409));
    expect(await api.createLink("o", { targetUrl: "https://a.co" })).toEqual({ status: "code_taken" });

    fetchMock.mockResolvedValueOnce(json({ error: "Demo limit: 20 links per visitor." }, 429));
    expect(await api.createLink("o", { targetUrl: "https://a.co" })).toEqual({
      status: "limit_reached",
      message: "Demo limit: 20 links per visitor.",
    });
  });

  it.each([401, 500, 502])("treats an unexpected %i as the backend being unavailable", async (status) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(json({ error: "x" }, status));
    await expect(api.createLink("o", { targetUrl: "https://a.co" })).rejects.toBeInstanceOf(BackendUnavailableError);
  });
});

describe("listLinks / setLinkActive", () => {
  it("parses a list", async () => {
    fetchMock.mockResolvedValue(json([linkDto]));
    const links = await api.listLinks("o");
    expect(links).toHaveLength(1);
    expect(links[0].shortCode).toBe("abc1234");
  });

  it("returns null for a link the owner does not have", async () => {
    fetchMock.mockResolvedValue(json({ error: "nope" }, 404));
    expect(await api.setLinkActive("o", "id-1", false)).toBeNull();
  });

  it("url-encodes the id", async () => {
    fetchMock.mockResolvedValue(json(linkDto));
    await api.setLinkActive("o", "a/b", true);
    expect(lastCall().url).toBe("https://go.example.com/links/a%2Fb");
  });
});

describe("followLink", () => {
  it("passes the Location through, sends no token, forwards visitor headers, skips afterResponse", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 307, headers: { Location: "https://target.example" } }));
    const result = await api.followLink("abc", { referrer: "https://ref.example", userAgent: "TestBrowser/1" });

    const { url, init } = lastCall();
    expect(url).toBe("https://go.example.com/r/abc");
    expect(init.redirect).toBe("manual");
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers).toMatchObject({ Referer: "https://ref.example", "User-Agent": "TestBrowser/1" });
    expect(result).toEqual({ status: "ok", targetUrl: "https://target.example" });
  });

  it("maps 404 and 410 (keeping the message)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 404 }));
    expect(await api.followLink("x", { referrer: null, userAgent: null })).toEqual({ status: "not_found" });

    fetchMock.mockResolvedValueOnce(new Response("This link has expired.", { status: 410 }));
    expect(await api.followLink("x", { referrer: null, userAgent: null })).toEqual({
      status: "gone",
      message: "This link has expired.",
    });
  });
});

describe("failure handling", () => {
  it("wraps network errors and timeouts", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(api.listLinks("o")).rejects.toBeInstanceOf(BackendUnavailableError);
  });

  it("rejects a response that breaks the contract", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(json([{ id: "only-an-id" }]));
    await expect(api.listLinks("o")).rejects.toBeInstanceOf(BackendUnavailableError);
  });
});

describe("getMeta", () => {
  it("asks the backend without a token and labels it as behind the BFF", async () => {
    fetchMock.mockResolvedValue(json({ implementation: "Go net/http + pgx", contractVersion: "1" }));
    expect(await api.getMeta()).toEqual({ name: "Next.js → Go net/http + pgx", contractVersion: "1" });
    expect(lastCall().init.headers.Authorization).toBeUndefined();
  });
});
