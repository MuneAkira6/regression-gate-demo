/**
 * The coverage report.
 *
 * The denominator is the manual test sheet, not the number of tests that happen to exist. Counting
 * tests answers "how much did we write"; counting the sheet answers "how much of what has to be
 * checked is checked", and only the second can tell you what is still uncovered. So every figure here
 * is per row of catalog/cases.csv. `automated` counts the rows a test actually claims, so the
 * percentage falls when a test goes missing, and the two lists at the end are the ones that matter: a case the
 * sheet says should be automated but no test claims (a gap), and a test claiming an id the sheet does
 * not have (an orphan). Either one means the sheet and the suite have drifted apart, so either one is
 * a non-zero exit.
 *
 * Cases marked `n/a` are out of the denominator, because they are declared out of scope with a
 * reason. That exclusion is the thing to re-examine later, not to trust: SCOPE.md's TB-023 is excluded
 * here and is exercised instead by the gate's INCONCLUSIVE fixture.
 *
 * Paths are resolved against the working directory, so `pnpm coverage` reads this repository and a
 * self-test can run the same tool against a planted one.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type Case = {
  id: string;
  domain: string;
  priority: string;
  title: string;
  steps: string;
  expected: string;
  automation: string;
};

export type Row = {
  domain: string;
  priority: string;
  cases: number;
  automated: number;
  manual: number;
  na: number;
  /** automated / (cases - n/a); null when that denominator is 0 and there is nothing to be a share of. */
  coverage: number | null;
};

export type Report = {
  rows: Row[];
  overall: Row;
  gaps: string[];
  orphans: string[];
};

export const SHEET_PATH = "catalog/cases.csv";
export const SPEC_DIRS = ["tests/ui", "tests/api"];

const CR = "\r";
const LF = "\n";

/**
 * An RFC 4180 reader. The sheet quotes any field holding a comma or a quote and doubles an inner
 * quote, so splitting on commas would tear rows apart — see TB-001's `expected`, which contains both.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === CR) {
      i += 1;
      continue;
    }
    if (ch === LF) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function readSheet(path = SHEET_PATH): Case[] {
  const rows = parseCsv(readFileSync(path, "utf8")).filter((r) => r.some((c) => c.trim() !== ""));
  const header = rows.shift();
  if (!header) throw new Error(`${path} is empty`);
  return rows.map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((name, i) => {
      record[name.trim()] = cells[i] ?? "";
    });
    return record as unknown as Case;
  });
}

/** Every `TB-nnn` that begins a test title in the given directories. */
export function collectTestIds(dirs = SPEC_DIRS): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const title = /\btest\s*(?:\.\s*\w+\s*)?\(\s*(['"`])(TB-\d{3})\s/g;
  for (const dir of dirs) {
    for (const file of specFiles(dir)) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(title)) {
        const id = match[2];
        found.set(id, [...(found.get(id) ?? []), file]);
      }
    }
  }
  return found;
}

function specFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...specFiles(path));
    else if (entry.endsWith(".spec.ts")) out.push(path);
  }
  return out;
}

/**
 * `automated` is a measurement, not a restatement of the plan: a case counts only when the sheet says
 * it should be automated **and** a test claims its id. Counting the `automation` column instead would
 * make the percentage unable to fall — it would print 100.0% in the same bucket as a gap, which is the
 * one thing this report exists to make impossible.
 */
function tally(domain: string, priority: string, cases: Case[], testIds: Set<string>): Row {
  const planned = (c: Case) => c.automation === "ui" || c.automation === "api";
  const automated = cases.filter((c) => planned(c) && testIds.has(c.id)).length;
  const manual = cases.filter((c) => c.automation === "manual").length;
  const na = cases.filter((c) => c.automation === "n/a").length;
  const denominator = cases.length - na;
  return {
    domain,
    priority,
    cases: cases.length,
    automated,
    manual,
    na,
    coverage: denominator === 0 ? null : (automated / denominator) * 100,
  };
}

export function buildReport(cases: Case[], testIds: Set<string>): Report {
  const keys = [...new Set(cases.map((c) => `${c.domain} ${c.priority}`))].sort();
  const rows = keys.map((key) => {
    const [domain, priority] = key.split(" ");
    return tally(
      domain,
      priority,
      cases.filter((c) => c.domain === domain && c.priority === priority),
      testIds,
    );
  });

  const shouldBeAutomated = cases.filter((c) => c.automation === "ui" || c.automation === "api");
  const gaps = shouldBeAutomated.filter((c) => !testIds.has(c.id)).map((c) => c.id);
  const sheetIds = new Set(cases.map((c) => c.id));
  const orphans = [...testIds].filter((id) => !sheetIds.has(id));

  return {
    rows,
    overall: tally("overall", "", cases, testIds),
    gaps: gaps.sort(),
    orphans: orphans.sort(),
  };
}

const HEAD = ["domain", "priority", "cases", "automated", "manual", "n/a", "coverage"];

function cells(row: Row): string[] {
  return [
    row.domain,
    row.priority,
    String(row.cases),
    String(row.automated),
    String(row.manual),
    String(row.na),
    row.coverage === null ? "-" : `${row.coverage.toFixed(1)}%`,
  ];
}

export function formatReport(report: Report, sheetPath = SHEET_PATH): string {
  const body = [...report.rows.map(cells), cells(report.overall)];
  const width = HEAD.map((h, i) => Math.max(h.length, ...body.map((r) => r[i].length)));
  const line = (r: string[]) =>
    r
      .map((c, i) => (i < 2 ? c.padEnd(width[i]) : c.padStart(width[i])))
      .join("  ")
      .trimEnd();
  const rule = width.map((w) => "-".repeat(w)).join("  ");

  const out = [
    `Coverage against ${sheetPath} — the denominator is the sheet, not the number of tests.`,
    "",
    line(HEAD),
    rule,
    ...report.rows.map((r) => line(cells(r))),
    rule,
    line(cells(report.overall)),
    "",
    `gaps    (a ui or api case with no test): ${report.gaps.join(", ") || "none"}`,
    `orphans (a test id not in the sheet)   : ${report.orphans.join(", ") || "none"}`,
  ];
  return `${out.join("\n")}\n`;
}

/** The whole tool: read, count, format, and the exit code the contract asks for. */
export function runReport(
  sheetPath = SHEET_PATH,
  specDirs = SPEC_DIRS,
): { text: string; code: number } {
  const cases = readSheet(sheetPath);
  const report = buildReport(cases, new Set(collectTestIds(specDirs).keys()));
  const clean = report.gaps.length === 0 && report.orphans.length === 0;
  return { text: formatReport(report, sheetPath), code: clean ? 0 : 1 };
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const { text, code } = runReport();
  process.stdout.write(text);
  process.exit(code);
}
