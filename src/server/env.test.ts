// Why this file exists: environment mistakes should fail fast and clearly, and
// the backend URL and token are the only settings this app needs.
import { describe, expect, it } from "vitest";

import { parseEnv } from "./env";

const valid = {
  LINK_BACKEND_URL: "https://go.example.com",
  LINK_BACKEND_TOKEN: "0123456789abcdef",
};

describe("parseEnv", () => {
  it("accepts a backend URL and token", () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it("requires LINK_BACKEND_URL", () => {
    expect(() => parseEnv({ LINK_BACKEND_TOKEN: valid.LINK_BACKEND_TOKEN })).toThrow(
      /LINK_BACKEND_URL/,
    );
  });

  it("requires a full URL", () => {
    expect(() => parseEnv({ ...valid, LINK_BACKEND_URL: "not a url" })).toThrow(
      /LINK_BACKEND_URL/,
    );
  });

  it("requires a token of at least 16 characters", () => {
    expect(() => parseEnv({ ...valid, LINK_BACKEND_TOKEN: "too-short" })).toThrow(
      /LINK_BACKEND_TOKEN/,
    );
    expect(() => parseEnv({ LINK_BACKEND_URL: valid.LINK_BACKEND_URL })).toThrow(
      /LINK_BACKEND_TOKEN/,
    );
  });
});
