// The gate's negative self-tests.
//
// Every one of these spawns the real `tools/gate.ts` against real fixture specs and reads the real
// process exit code. Nothing here hand-writes a Playwright report: a gate checked against a forged
// report only proves that its parser works, and the thing worth proving is that it draws the right
// conclusion from a run that actually happened.
//
// Each run gets its own port in 18431-18439 and starts its own app, so no run that redeploys can
// touch the app another run is using — and none of them can touch the real suite on 18430, whose
// TB-022 asserts the version is exactly 1.4.0.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const GATE = fileURLToPath(new URL("../tools/gate.ts", import.meta.url));
const VALID = "tests/fixtures/known-reds/valid.yml";

/** A gate run costs an app start plus one Playwright process per unit. */
const SLOW = 180_000;

type Run = { code: number; out: string };

function runGate(specs: string, knownReds: string, port: number): Run {
  const result = spawnSync(process.execPath, [GATE], {
    cwd: ROOT,
    env: { ...process.env, GATE_SPECS: specs, KNOWN_REDS: knownReds, PORT: String(port) },
    encoding: "utf8",
    timeout: SLOW,
  });
  return { code: result.status ?? -1, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function gateReport(): {
  counts: Record<string, number>;
  exitCode: number;
  findings: { className: string; id: string; unit: string; advice: string }[];
} {
  return JSON.parse(readFileSync(`${ROOT}reports/gate.json`, "utf8"));
}

describe("the gate classifies a red by what the build was doing", () => {
  it(
    "calls an undeclared red on a steady build a NEW RED, and exits 1",
    () => {
      const { code, out } = runGate("tests/fixtures/new-red", VALID, 18431);
      expect(out).toContain("NEW RED — 1 (counts as a failure)");
      expect(out).toContain("TB-901 fails on a build that did not change");
      expect(out).toContain("treat as a regression until reproduced otherwise on the same build");
      expect(out).not.toContain("INCONCLUSIVE — ");
      expect(out).toContain("result: 1 NEW RED, 0 INCONCLUSIVE, 0 KNOWN RED, 0 WENT GREEN");
      expect(code).toBe(1);
    },
    SLOW,
  );

  it(
    "calls a declared red a KNOWN RED, prints its reason and source, and exits 0",
    () => {
      const { code, out } = runGate("tests/fixtures/known-red", VALID, 18432);
      expect(out).toContain("KNOWN RED — 1 (not counted as a failure)");
      expect(out).toContain("TB-902 is declared red and still fails");
      // the advice is the declaration's own reason and source
      expect(out).toContain("A fixture red declared so the gate has a KNOWN RED to classify.");
      expect(out).toContain("source: tests/fixtures/known-red/known-red.spec.ts");
      expect(out).toContain("declared 2026-09-30");
      // a red, but not a failure
      expect(code).toBe(0);
    },
    SLOW,
  );

  it(
    "calls an undeclared red across a mid-unit redeployment INCONCLUSIVE, and exits 2",
    () => {
      const { code, out } = runGate("tests/fixtures/inconclusive", VALID, 18434);
      expect(out).toContain("<-- version under test CHANGED during this unit");
      expect(out).toContain("INCONCLUSIVE — 1 (counts as a failure)");
      expect(out).toContain("TB-904 fails while the version under test changes");
      // the advice names both readings, so the reader knows which builds were involved
      expect(out).toMatch(
        /rerun this unit on one build: the version under test moved from 1\.4\.0 \(build [0-9a-f]{12}\) to 9\.9\.9 \(build [0-9a-f]{12}\) during this unit/,
      );
      expect(out).toContain("result: 0 NEW RED, 1 INCONCLUSIVE, 0 KNOWN RED, 0 WENT GREEN");
      expect(code).toBe(2);
    },
    SLOW,
  );

  it(
    "separates a NEW RED from an INCONCLUSIVE in one run, and lets the NEW RED decide the exit",
    () => {
      // One invocation, one app, one declarations file, two undeclared reds. The only difference is
      // that the second unit redeploys — which is the whole claim the gate makes.
      const { code, out } = runGate("tests/fixtures/mixed", VALID, 18436);
      expect(out).toContain("NEW RED — 1 (counts as a failure)");
      expect(out).toContain("TB-906 fails on a build that did not change");
      expect(out).toContain("INCONCLUSIVE — 1 (counts as a failure)");
      expect(out).toContain("TB-907 fails while the version under test changes");
      expect(out).toContain("result: 1 NEW RED, 1 INCONCLUSIVE, 0 KNOWN RED, 0 WENT GREEN");
      // 1 if any NEW RED; else 2 if any INCONCLUSIVE. A NEW RED outranks an INCONCLUSIVE.
      expect(code).toBe(1);

      // The file must say what the table said.
      const report = gateReport();
      expect(report.counts).toEqual({
        "NEW RED": 1,
        INCONCLUSIVE: 1,
        "KNOWN RED": 0,
        "WENT GREEN": 0,
      });
      expect(report.exitCode).toBe(1);
      expect(report.findings.map((f) => [f.className, f.id]).sort()).toEqual([
        ["INCONCLUSIVE", "TB-907"],
        ["NEW RED", "TB-906"],
      ]);
    },
    SLOW,
  );
});

describe("the gate reports a declared red that passed without re-baselining it", () => {
  it(
    "reports WENT GREEN and leaves the removal to a person",
    () => {
      const before = readFileSync(`${ROOT}${VALID}`, "utf8");
      const { code, out } = runGate("tests/fixtures/went-green", VALID, 18433);
      expect(out).toContain("WENT GREEN — 1 (reported only)");
      expect(out).toContain("TB-903 was declared red and now passes");
      expect(out).toContain(
        "verify on one build, then remove the declaration by hand; " +
          "the gate never rewrites known-reds.yml",
      );
      // this unit's build did not move, so there is no redeployment caveat to add
      expect(out).not.toContain("across a redeployment");
      expect(code).toBe(0);
      // and the claim in that advice is true: the declarations file is untouched
      expect(readFileSync(`${ROOT}${VALID}`, "utf8")).toBe(before);
    },
    SLOW,
  );

  it(
    "adds that a pass across a redeployment is not evidence of a fix",
    () => {
      const { code, out } = runGate("tests/fixtures/went-green-across-deploy", VALID, 18435);
      expect(out).toContain("<-- version under test CHANGED during this unit");
      expect(out).toContain("WENT GREEN — 1 (reported only)");
      expect(out).toContain("across a redeployment: not evidence of a fix");
      expect(out).toContain("result: 0 NEW RED, 0 INCONCLUSIVE, 0 KNOWN RED, 1 WENT GREEN");
      expect(code).toBe(0);
    },
    SLOW,
  );
});

describe("the gate refuses to judge on bad input, and says exit 3", () => {
  it("names the entry that has no reason", () => {
    const { code, out } = runGate(
      "tests/fixtures/known-red",
      "tests/fixtures/known-reds/missing-reason.yml",
      18437,
    );
    expect(out).toContain("input error");
    // the file's first entry is complete; the message must point at the second
    expect(out).toContain("TB-902b in tests/fixtures/known-reds/missing-reason.yml has no reason");
    // it fails before any app is started
    expect(out).not.toContain("Gate — Acme Tasks on");
    expect(code).toBe(3);
  });

  it("names the entry that has no source", () => {
    const { code, out } = runGate(
      "tests/fixtures/known-red",
      "tests/fixtures/known-reds/missing-source.yml",
      18437,
    );
    expect(out).toContain("TB-902 in tests/fixtures/known-reds/missing-source.yml has no source");
    expect(code).toBe(3);
  });

  it("rejects a malformed declarations file", () => {
    const { code, out } = runGate(
      "tests/fixtures/known-red",
      "tests/fixtures/known-reds/malformed.yml",
      18437,
    );
    expect(out).toContain("is not valid YAML");
    expect(code).toBe(3);
  });

  it("rejects a declarations file that is not a list", () => {
    const { code, out } = runGate(
      "tests/fixtures/known-red",
      "tests/fixtures/known-reds/not-a-list.yml",
      18437,
    );
    expect(out).toContain("must be a list of entries");
    expect(code).toBe(3);
  });

  it("rejects a declarations file that does not exist", () => {
    const { code, out } = runGate(
      "tests/fixtures/known-red",
      "tests/fixtures/known-reds/nope.yml",
      18437,
    );
    expect(out).toContain("does not exist");
    expect(code).toBe(3);
  });

  it(
    "will not call a unit that ran no test a green unit",
    () => {
      // Playwright writes a report with `suites: []` and exits 1 when it finds no test. Booking that
      // as `0 passed, 0 failed` would make the gate report green for a unit that never ran.
      const { code, out } = runGate("tests/fixtures/no-tests", VALID, 18438);
      expect(out).toContain("ran no test at all");
      expect(out).not.toContain("result: 0 NEW RED, 0 INCONCLUSIVE, 0 KNOWN RED, 0 WENT GREEN");
      expect(code).toBe(3);
    },
    SLOW,
  );
});
