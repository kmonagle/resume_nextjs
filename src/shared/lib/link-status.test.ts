// Why this file exists: pins down the precedence rules for link status, which
// the SQL in claimClick() and every other backend must reproduce.
import { describe, expect, it } from "vitest";

import { getLinkStatus } from "./link-status";

const now = new Date("2026-01-01T00:00:00Z");
const base = { isActive: true, expiresAt: null, maxClicks: null, clickCount: 0 };

describe("getLinkStatus", () => {
  it("is active by default", () => {
    expect(getLinkStatus(base, now)).toBe("active");
  });

  it("is disabled when switched off, even if also expired", () => {
    const link = { ...base, isActive: false, expiresAt: new Date("2025-01-01") };
    expect(getLinkStatus(link, now)).toBe("disabled");
  });

  it("is expired once expiresAt is in the past", () => {
    const link = { ...base, expiresAt: new Date("2025-12-31T23:59:59Z") };
    expect(getLinkStatus(link, now)).toBe("expired");
  });

  it("is max_clicks exactly when the count reaches the limit", () => {
    expect(getLinkStatus({ ...base, maxClicks: 3, clickCount: 2 }, now)).toBe("active");
    expect(getLinkStatus({ ...base, maxClicks: 3, clickCount: 3 }, now)).toBe("max_clicks");
  });

  it("prefers expired over max_clicks", () => {
    const link = { ...base, maxClicks: 1, clickCount: 1, expiresAt: new Date("2025-01-01") };
    expect(getLinkStatus(link, now)).toBe("expired");
  });
});
