// Self-tests for the coverage report, on planted inputs.
//
// The gap and the orphan are planted in a miniature repository under the OS temp directory and the
// real tool is spawned against it, so what is observed is a real process exit code. The repository's
// own catalog/cases.csv and suite are never touched to manufacture a failure.
//
// Every case that plants a gap asserts the *figures*, not only the gap list. An earlier version of
// tally() counted the sheet's `automation` column instead of the tests that exist, so the percentage
// could not fall: the tool printed `home P0  2 cases  2 automated  100.0%` in the same output as
// `gaps ...: TB-002`. A list-only assertion passed happily through that, which is why the numbers are
// pinned here.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildReport,
  collectTestIds,
  parseCsv,
  readSheet,
  runReport,
} from "../tools/coverage-report.ts";

const TOOL = fileURLToPath(new URL("../tools/coverage-report.ts", import.meta.url));
const HEADER = ["id", "domain", "priority", "title", "steps", "expected", "automation"];

let planted: string[] = [];

afterEach(() => {
  for (const dir of planted) rmSync(dir, { recursive: true, force: true });
  planted = [];
});

function csv(rows: string[][]): string {
  const cell = (c: string) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  return `${rows.map((r) => r.map(cell).join(",")).join("\n")}\n`;
}

/** A miniature repository: a sheet, and spec files whose titles start with the ids given. */
function plant(cases: string[][], uiIds: string[] = [], apiIds: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), "rgd-cov-"));
  planted.push(dir);
  mkdirSync(join(dir, "catalog"), { recursive: true });
  mkdirSync(join(dir, "tests/ui"), { recursive: true });
  mkdirSync(join(dir, "tests/api"), { recursive: true });
  writeFileSync(join(dir, "catalog/cases.csv"), csv([HEADER, ...cases]));
  const spec = (ids: string[]) =>
    `${ids.map((id) => `test("${id} a planted test", async () => {});`).join("\n")}\n`;
  writeFileSync(join(dir, "tests/ui/planted.spec.ts"), spec(uiIds));
  writeFileSync(join(dir, "tests/api/planted.spec.ts"), spec(apiIds));
  return dir;
}

/** Run the real tool in a planted repository and return what a shell would see. */
function run(dir: string): { code: number; out: string } {
  const result = spawnSync(process.execPath, [TOOL], { cwd: dir, encoding: "utf8" });
  return { code: result.status ?? -1, out: result.stdout + result.stderr };
}

const CASE = (id: string, domain: string, priority: string, automation: string) => [
  id,
  domain,
  priority,
  `${id} title`,
  "steps",
  "expected",
  automation,
];

/** `<domain> <priority> <cases> <automated> <manual> <n/a> <coverage>` as the table prints it. */
function bucket(domain: string, priority: string, figures: string): RegExp {
  return new RegExp(`${domain}\\s+${priority}\\s+${figures.trim().replace(/\s+/g, "\\s+")}`);
}

describe("the coverage report's exit code", () => {
  it("exits 0 when there is neither a gap nor an orphan", () => {
    const dir = plant(
      [CASE("TB-001", "home", "P0", "ui"), CASE("TB-002", "api", "P0", "api")],
      ["TB-001"],
      ["TB-002"],
    );
    const { code, out } = run(dir);
    expect(out).toMatch(bucket("home", "P0", "1 1 0 0 100.0%"));
    expect(out).toMatch(bucket("api", "P0", "1 1 0 0 100.0%"));
    expect(out).toMatch(bucket("overall", "", "2 2 0 0 100.0%"));
    expect(out).toContain("gaps    (a ui or api case with no test): none");
    expect(out).toContain("orphans (a test id not in the sheet)   : none");
    expect(code).toBe(0);
  });

  it("exits 1 on a planted gap, naming the case and lowering its bucket", () => {
    // TB-002 says automation `api` but no test claims it.
    const dir = plant(
      [CASE("TB-001", "home", "P0", "ui"), CASE("TB-002", "api", "P0", "api")],
      ["TB-001"],
      [],
    );
    const { code, out } = run(dir);
    expect(out).toMatch(bucket("api", "P0", "1 0 0 0 0.0%"));
    expect(out).toMatch(bucket("overall", "", "2 1 0 0 50.0%"));
    expect(out).toContain("gaps    (a ui or api case with no test): TB-002");
    expect(out).toContain("orphans (a test id not in the sheet)   : none");
    expect(code).toBe(1);
  });

  it("lowers the affected bucket and the overall figure, and leaves other buckets alone", () => {
    // The regression guard for the defect described at the top of this file: two api cases, one of
    // them with no test, and one untouched home case.
    const dir = plant(
      [
        CASE("TB-001", "api", "P0", "api"),
        CASE("TB-002", "api", "P0", "api"),
        CASE("TB-003", "home", "P0", "ui"),
      ],
      ["TB-003"],
      ["TB-001"],
    );
    const { code, out } = run(dir);
    // the bucket that lost a test falls to half...
    expect(out).toMatch(bucket("api", "P0", "2 1 0 0 50.0%"));
    // ...the untouched bucket does not move...
    expect(out).toMatch(bucket("home", "P0", "1 1 0 0 100.0%"));
    // ...and the overall line falls with it: 2 of 3.
    expect(out).toMatch(bucket("overall", "", "3 2 0 0 66.7%"));
    expect(out).toContain("gaps    (a ui or api case with no test): TB-002");
    // what the old code printed, and what must never appear beside a gap again
    expect(out).not.toMatch(bucket("api", "P0", "2 2 0 0 100.0%"));
    expect(out).not.toMatch(bucket("overall", "", "3 3 0 0 100.0%"));
    expect(code).toBe(1);
  });

  it("exits 1 on a planted orphan, naming the test id and leaving the figures alone", () => {
    // TB-999 is claimed by a test but is not a row of the sheet. An orphan is not in the denominator,
    // so it must not move any percentage — it is a drift signal, not a coverage one.
    const dir = plant([CASE("TB-001", "home", "P0", "ui")], ["TB-001", "TB-999"], []);
    const { code, out } = run(dir);
    expect(out).toMatch(bucket("home", "P0", "1 1 0 0 100.0%"));
    expect(out).toMatch(bucket("overall", "", "1 1 0 0 100.0%"));
    expect(out).toContain("gaps    (a ui or api case with no test): none");
    expect(out).toContain("orphans (a test id not in the sheet)   : TB-999");
    expect(code).toBe(1);
  });

  it("exits 1 and lists both when a gap and an orphan are planted together", () => {
    const dir = plant(
      [CASE("TB-001", "home", "P0", "ui"), CASE("TB-002", "api", "P0", "api")],
      ["TB-001", "TB-888"],
      [],
    );
    const { code, out } = run(dir);
    expect(out).toMatch(bucket("api", "P0", "1 0 0 0 0.0%"));
    expect(out).toMatch(bucket("overall", "", "2 1 0 0 50.0%"));
    expect(out).toContain("gaps    (a ui or api case with no test): TB-002");
    expect(out).toContain("orphans (a test id not in the sheet)   : TB-888");
    expect(code).toBe(1);
  });

  it("does not count a manual or n/a case as a gap", () => {
    const dir = plant(
      [CASE("TB-001", "home", "P1", "manual"), CASE("TB-002", "api", "P1", "n/a")],
      [],
      [],
    );
    const { code, out } = run(dir);
    // the manual case stays in the denominator and reads 0.0%; the n/a case leaves it, so it reads -
    expect(out).toMatch(bucket("home", "P1", "1 0 1 0 0.0%"));
    expect(out).toMatch(bucket("api", "P1", "1 0 0 1 -"));
    expect(out).toMatch(bucket("overall", "", "2 0 1 1 0.0%"));
    expect(out).toContain("gaps    (a ui or api case with no test): none");
    expect(code).toBe(0);
  });
});

describe("the coverage report's arithmetic", () => {
  it("divides by cases minus n/a, to one decimal", () => {
    // 2 automated of 3 in the denominator (4 cases, 1 of them n/a) = 66.666... -> 66.7%
    const cases = [
      CASE("TB-001", "home", "P0", "ui"),
      CASE("TB-002", "home", "P0", "api"),
      CASE("TB-003", "home", "P0", "manual"),
      CASE("TB-004", "home", "P0", "n/a"),
    ];
    const report = buildReport(readSheet(plantSheetOnly(cases)), new Set(["TB-001", "TB-002"]));
    expect(report.overall.coverage?.toFixed(1)).toBe("66.7");
    expect(report.rows[0].automated).toBe(2);
    expect(report.rows[0].na).toBe(1);
  });

  it("shows a dash rather than a division by zero when every case is n/a", () => {
    const { text } = runReport(plantSheetOnly([CASE("TB-001", "api", "P1", "n/a")]), []);
    expect(text).toMatch(bucket("api", "P1", "1 0 0 1 -"));
  });

  it("counts a manual case as uncovered rather than hiding it", () => {
    // The honest 0.0%: one case, automated by nobody, and it still sits in the denominator.
    const { text } = runReport(plantSheetOnly([CASE("TB-003", "home", "P1", "manual")]), []);
    expect(text).toMatch(bucket("home", "P1", "1 0 1 0 0.0%"));
  });
});

function plantSheetOnly(cases: string[][]): string {
  const dir = mkdtempSync(join(tmpdir(), "rgd-cov-"));
  planted.push(dir);
  writeFileSync(join(dir, "cases.csv"), csv([HEADER, ...cases]));
  return join(dir, "cases.csv");
}

describe("the sheet reader", () => {
  it("reads a quoted field holding a comma and a doubled quote as one field", () => {
    const rows = parseCsv('a,b\n1,"has, a comma and ""quotes"" inside"\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["1", 'has, a comma and "quotes" inside'],
    ]);
  });

  it("keeps a newline that sits inside a quoted field", () => {
    const rows = parseCsv('a\n"two\nlines"\n');
    expect(rows).toEqual([["a"], ["two\nlines"]]);
  });

  it("reads this repository's real sheet as 23 cases", () => {
    const cases = readSheet("catalog/cases.csv");
    expect(cases.length).toBe(23);
    expect(cases[0].id).toBe("TB-001");
    expect(cases.map((c) => c.id)).toContain("TB-023");
  });
});

describe("this repository's own figures", () => {
  it("measures 21 of a 22-case denominator, with no gap and no orphan", () => {
    // Pinned so a change that stops the report measuring the suite is caught by `pnpm test`, not only
    // by a person reading the table.
    const { text, code } = runReport();
    expect(text).toMatch(bucket("overall", "", "23 21 1 1 95.5%"));
    expect(text).toMatch(bucket("api", "P1", "5 4 0 1 100.0%"));
    expect(text).toMatch(bucket("home", "P1", "1 0 1 0 0.0%"));
    expect(text).toContain("gaps    (a ui or api case with no test): none");
    expect(text).toContain("orphans (a test id not in the sheet)   : none");
    expect(code).toBe(0);
  });
});

describe("the scan's scope", () => {
  it("reads tests/ui and tests/api but never the gate fixtures", () => {
    const ids = collectTestIds(["tests/ui", "tests/api"]);
    expect([...ids.keys()].sort()).toEqual([
      "TB-001",
      "TB-002",
      "TB-004",
      "TB-005",
      "TB-006",
      "TB-007",
      "TB-008",
      "TB-009",
      "TB-010",
      "TB-011",
      "TB-012",
      "TB-013",
      "TB-014",
      "TB-015",
      "TB-016",
      "TB-017",
      "TB-018",
      "TB-019",
      "TB-020",
      "TB-021",
      "TB-022",
    ]);
    // The fixtures use TB-9xx ids that are in no sheet row, so if the scan reached them every one
    // would surface as an orphan and `pnpm coverage` could never exit 0.
    const fixtureIds = collectTestIds(["tests/fixtures"]);
    expect(fixtureIds.size).toBeGreaterThan(0);
    for (const id of fixtureIds.keys()) expect(ids.has(id)).toBe(false);
  });
});
