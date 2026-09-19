// Why this file exists: the DTO is the wire format. These tests make sure dates
// become ISO strings and that status is computed at conversion time.
import { describe, expect, it } from "vitest";

import { toLinkDto } from "./link-dto";

const record = {
  id: "abc",
  shortCode: "xyz1234",
  targetUrl: "https://example.com",
  title: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  expiresAt: null,
  maxClicks: 2,
  clickCount: 2,
  isActive: true,
};

describe("toLinkDto", () => {
  it("serialises dates as ISO strings and survives a JSON round trip", () => {
    const dto = toLinkDto(record);
    expect(dto.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });

  it("precomputes status", () => {
    expect(toLinkDto(record).status).toBe("max_clicks");
    expect(toLinkDto({ ...record, clickCount: 0 }).status).toBe("active");
  });

  it("renders expiresAt as an ISO string or null", () => {
    const expiresAt = new Date("2030-05-05T10:00:00Z");
    expect(toLinkDto({ ...record, expiresAt }, new Date("2026-01-01")).expiresAt).toBe(
      "2030-05-05T10:00:00.000Z",
    );
    expect(toLinkDto(record).expiresAt).toBeNull();
  });
});
