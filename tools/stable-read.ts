/**
 * The stable read.
 *
 * Most of the instability in a UI suite is a waiting problem, not a product problem: waiting for a
 * *state* ("the spinner is gone", "the element is visible") and then reading a value returns
 * whatever the page happened to be rendering at that instant, which for an animating control is a
 * number that was true for a moment and is wrong by the time it is asserted.
 *
 * So instead of waiting for a state, wait for agreement: read the value over and over and believe it
 * only once it has come back the same `n` times in a row. `n` is a property of the control, not of
 * the suite, so it lives in tests/controls.json.
 *
 * This is not a sleep. A sleep guesses how long settling takes and hides the answer either way — too
 * short and the read is still wrong, too long and every run pays for it. Agreement is evidence.
 */

export type StableReadOptions = {
  /** How many consecutive reads must agree before the value is believed. At least 1. */
  n: number;
  /** How long to wait between reads. */
  intervalMs?: number;
  /** How long to keep trying before giving up. */
  timeoutMs?: number;
};

/** Thrown when no value ever agreed with itself `n` times; it carries every read it saw. */
export class StableReadTimeoutError extends Error {
  readonly values: readonly unknown[];

  constructor(message: string, values: readonly unknown[]) {
    super(message);
    this.name = "StableReadTimeoutError";
    this.values = values;
  }
}

/** Render a read for a human, so the timeout message is worth reading. */
function show(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Call `read()` until it returns the same value `n` times in a row, and return that value. On
 * timeout, throw an error that lists every value it saw — so a failure says what the control was
 * actually doing instead of only that it never settled.
 */
export async function readStable<T>(
  read: () => T | Promise<T>,
  options: StableReadOptions,
): Promise<T> {
  const { n, intervalMs = 100, timeoutMs = 5000 } = options;
  if (!Number.isInteger(n) || n < 1) {
    throw new TypeError(`readStable: n must be an integer of at least 1, got ${show(n)}`);
  }

  const seen: T[] = [];
  const deadline = Date.now() + timeoutMs;
  let streak = 0;

  for (;;) {
    const value = await read();
    streak = seen.length > 0 && sameValue(value, seen[seen.length - 1]) ? streak + 1 : 1;
    seen.push(value);
    if (streak >= n) return value;

    if (Date.now() >= deadline) {
      throw new StableReadTimeoutError(
        `readStable: no value repeated ${n} times in a row within ${timeoutMs} ms; ` +
          `the reads were ${seen.map(show).join(", ")}`,
        seen,
      );
    }
    await sleep(intervalMs);
  }
}
