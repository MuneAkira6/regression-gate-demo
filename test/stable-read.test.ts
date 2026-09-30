// Self-tests for the stable read. The interesting cases are the near misses: a value that repeats
// but fewer than n times, and a value that alternates so that every read has a twin somewhere but
// never *in a row*. Both are the shapes a real animating control produces.

import { describe, expect, it } from "vitest";
import { readStable, StableReadTimeoutError } from "../tools/stable-read.ts";

/** A read that walks a script and then keeps returning its last value. */
function scripted<T>(values: T[]): { read: () => T; calls: () => number } {
  let i = 0;
  return {
    read: () => values[Math.min(i++, values.length - 1)],
    calls: () => i,
  };
}

describe("readStable", () => {
  it("returns the value once it has agreed n times in a row", async () => {
    const { read, calls } = scripted(["0", "1", "2", "3", "4", "4", "4"]);
    expect(await readStable(read, { n: 3, intervalMs: 0 })).toBe("4");
    expect(calls()).toBe(7);
  });

  it("is not satisfied by a repeat shorter than n", async () => {
    // "1" comes back twice in a row, which n=3 must reject; only "2" earns the answer.
    const { read } = scripted(["1", "1", "2", "2", "2"]);
    expect(await readStable(read, { n: 3, intervalMs: 0 })).toBe("2");
  });

  it("counts only consecutive agreement, not agreement anywhere", async () => {
    const { read } = scripted(["1", "2", "1", "2", "1", "1", "1"]);
    expect(await readStable(read, { n: 3, intervalMs: 0 })).toBe("1");
  });

  it("with n=1 believes the first read", async () => {
    const { read, calls } = scripted(["7", "8", "9"]);
    expect(await readStable(read, { n: 1, intervalMs: 0 })).toBe("7");
    expect(calls()).toBe(1);
  });

  it("awaits an asynchronous read", async () => {
    const { read } = scripted([1, 2, 2, 2]);
    const asAsync = () => Promise.resolve(read());
    expect(await readStable(asAsync, { n: 3, intervalMs: 0 })).toBe(2);
  });

  it("compares object values by their content", async () => {
    const { read } = scripted([{ a: 1 }, { a: 2 }, { a: 2 }, { a: 2 }]);
    expect(await readStable(read, { n: 3, intervalMs: 0 })).toEqual({ a: 2 });
  });

  it("throws on timeout with every value it saw listed", async () => {
    let i = 0;
    const read = () => i++; // never repeats, so it can never settle
    const error = await readStable(read, { n: 3, intervalMs: 1, timeoutMs: 30 }).then(
      () => undefined,
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(StableReadTimeoutError);
    const timeout = error as StableReadTimeoutError;
    expect(timeout.message).toContain("no value repeated 3 times in a row within 30 ms");
    expect(timeout.message).toContain("the reads were 0");
    expect(timeout.values.length).toBeGreaterThanOrEqual(1);
    expect(timeout.values[0]).toBe(0);
  });

  it("rejects an n below 1", async () => {
    await expect(readStable(() => "x", { n: 0 })).rejects.toThrow(
      "readStable: n must be an integer of at least 1, got 0",
    );
  });
});
