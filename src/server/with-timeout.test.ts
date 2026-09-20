// Why this file exists: the dashboard's "don't hang on a sleeping backend" behaviour depends on
// this helper, so its three outcomes (fast value, slow, and failure) are pinned down.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BackendUnavailableError } from "@/server/link-api/types";
import { withTimeout } from "./with-timeout";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("withTimeout", () => {
  it("returns the value when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok");
  });

  it("rejects with BackendUnavailableError when the promise is too slow", async () => {
    const slow = new Promise<string>(() => {}); // never settles
    const result = withTimeout(slow, 1000);
    const assertion = expect(result).rejects.toBeInstanceOf(BackendUnavailableError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("passes the original error through when the promise fails first", async () => {
    const boom = new BackendUnavailableError("down");
    await expect(withTimeout(Promise.reject(boom), 1000)).rejects.toBe(boom);
  });

  it("does not leave a timer running after the promise settles", async () => {
    await withTimeout(Promise.resolve(1), 1000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
