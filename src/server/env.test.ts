// Why this file exists: environment mistakes should fail fast and clearly, and
// LINK_BACKEND is what selects the backend, so its rules are worth pinning.
import { describe, expect, it } from "vitest";

import { parseEnv } from "./env";

const base = { DATABASE_URL: "postgres://localhost/db" };

describe("parseEnv", () => {
  it("defaults LINK_BACKEND to local", () => {
    expect(parseEnv(base).LINK_BACKEND).toBe("local");
  });

  it("requires DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rejects an unknown LINK_BACKEND", () => {
    expect(() => parseEnv({ ...base, LINK_BACKEND: "cobol" })).toThrow(/LINK_BACKEND/);
  });

  it("requires a URL and token for remote", () => {
    expect(() => parseEnv({ ...base, LINK_BACKEND: "remote" })).toThrow(/LINK_BACKEND_URL/);
    expect(
      parseEnv({
        ...base,
        LINK_BACKEND: "remote",
        LINK_BACKEND_URL: "https://go.example.com",
        LINK_BACKEND_TOKEN: "0123456789abcdef",
      }).LINK_BACKEND,
    ).toBe("remote");
  });
});
