/**
 * The quality gate.
 *
 * A red test is not one thing. On a shared environment that is redeployed several times a day, the
 * same failing assertion can mean four different things, and treating them alike is how a gate stops
 * being believed:
 *
 *   KNOWN RED     already understood, with a reason and a source, and not a product defect. Listed
 *                 every time, but not counted as a failure.
 *   INCONCLUSIVE  the version under test changed while this unit was running, so the run does not
 *                 say anything about either build. Counted as a failure, because "we do not know" is
 *                 not the same as "it is fine".
 *   NEW RED       not declared, and the build did not move. This is the one to act on.
 *   WENT GREEN    a declared red that passed. Reported only. The gate never edits the declaration,
 *                 because re-baselining is a judgement and a tool that re-baselines itself will
 *                 eventually bless a real regression.
 *
 * To tell them apart, the version under test is read immediately before and immediately after each
 * unit, and a unit is one spec file run in its own process. One app is started for the whole run and
 * kept up: the build id is drawn once per process, so restarting the app between units would
 * manufacture INCONCLUSIVE everywhere.
 */

import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { get } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { parse } from "yaml";

export type Declaration = { id: string; reason: string; source: string; declared: string };
export type Version = { version: string; build: string };

export type Finding = {
  className: "NEW RED" | "INCONCLUSIVE" | "KNOWN RED" | "WENT GREEN";
  id: string;
  unit: string;
  test: string;
  advice: string;
};

export type UnitResult = {
  file: string;
  before: Version;
  after: Version;
  changed: boolean;
  passed: string[];
  failed: string[];
};

/** Anything wrong with the gate's *input* rather than with the product: always exit 3. */
class InputError extends Error {}

const DEFAULT_KNOWN_REDS = "known-reds.yml";
const DEFAULT_SPEC_DIRS = ["tests/ui", "tests/api"];
const REQUIRED = ["id", "reason", "source", "declared"] as const;

// --- inputs ---------------------------------------------------------------------------------------

/**
 * Read and validate the declarations. An entry missing any of the four required keys is an input
 * error naming that entry, because a declaration without a reason or a source is exactly the kind of
 * quiet baseline this gate exists to prevent.
 */
export function readKnownReds(path: string): Declaration[] {
  if (!existsSync(path)) {
    throw new InputError(`known reds: ${path} does not exist`);
  }
  let parsed: unknown;
  try {
    parsed = parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new InputError(`known reds: ${path} is not valid YAML: ${(err as Error).message}`);
  }
  if (parsed === null || parsed === undefined) return [];
  if (!Array.isArray(parsed)) {
    throw new InputError(`known reds: ${path} must be a list of entries, got ${typeof parsed}`);
  }

  return parsed.map((entry, i) => {
    const where = `entry ${i + 1}`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new InputError(`known reds: ${where} of ${path} is not a mapping`);
    }
    const record = entry as Record<string, unknown>;
    const name = typeof record.id === "string" && record.id !== "" ? record.id : where;
    for (const key of REQUIRED) {
      const value = record[key];
      if (typeof value !== "string" || value.trim() === "") {
        throw new InputError(`known reds: ${name} in ${path} has no ${key}`);
      }
    }
    return {
      id: String(record.id).trim(),
      reason: String(record.reason).trim().replace(/\s+/g, " "),
      source: String(record.source).trim(),
      declared: String(record.declared).trim(),
    };
  });
}

/**
 * Every spec file under the given directories, in file-name order across all of them. Paths use `/`
 * on every platform: Playwright reads a file argument as a regular expression, so a Windows `\`
 * would match nothing, and the order and the printed names stay the same everywhere.
 */
export function specFiles(dirs: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name).split(sep).join("/");
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".spec.ts")) out.push(path);
    }
  };
  for (const dir of dirs) walk(dir);
  return out.sort();
}

// --- the app under test ---------------------------------------------------------------------------

/**
 * Read `/version` on a fresh connection. A unit runs Playwright through `spawnSync`, which blocks this
 * event loop for the whole unit, so a pooled keep-alive socket that the app closed in the meantime
 * still looks reusable. On Windows the read after a unit longer than the app's keep-alive timeout
 * (5 s) then fails with ECONNRESET. One connection per read behaves the same on every platform.
 */
function readVersion(base: string): Promise<Version> {
  return new Promise((resolveVersion, reject) => {
    const request = get(`${base}/version`, { agent: false }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        text += chunk;
      });
      response.on("error", reject);
      response.on("end", () => {
        const status = response.statusCode ?? 0;
        if (status < 200 || status > 299) {
          reject(new InputError(`the app answered ${status} on ${base}/version`));
          return;
        }
        try {
          const body = JSON.parse(text) as Version;
          if (typeof body.version !== "string" || typeof body.build !== "string") {
            throw new InputError(`the app returned no version/build on ${base}/version`);
          }
          resolveVersion(body);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

/**
 * Start the app and wait until it answers. It is spawned as `node apps/sample-app/server.ts` rather
 * than through `pnpm app`, so the pid we hold is the server's: a signal sent to a package-manager
 * wrapper does not necessarily reach the process it started.
 */
async function startApp(port: number, base: string): Promise<ChildProcess> {
  const child = spawn(process.execPath, ["apps/sample-app/server.ts"], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const deadline = Date.now() + 15_000;
  for (;;) {
    if (child.exitCode !== null) {
      throw new InputError(`the app exited with ${child.exitCode} before answering on ${base}`);
    }
    try {
      await readVersion(base);
      return child;
    } catch {
      if (Date.now() >= deadline) {
        child.kill("SIGKILL");
        throw new InputError(`the app never answered on ${base}/version within 15s`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

/** Stop the app and wait for it to be gone. A kill that has not been reaped is not a stopped app. */
async function stopApp(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((r) => child.once("exit", () => r()));
  child.kill("SIGTERM");
  const timer = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 5000));
  if ((await Promise.race([exited.then(() => "exited" as const), timer])) === "timeout") {
    child.kill("SIGKILL");
    await exited;
  }
}

// --- one unit -------------------------------------------------------------------------------------

type SpecOutcome = { title: string; id: string; failed: boolean };

/** Pull every test out of a Playwright JSON report, however deeply its suites are nested. */
export function outcomesFromReport(report: unknown): SpecOutcome[] {
  const out: SpecOutcome[] = [];
  const visit = (suites: unknown[]) => {
    for (const suite of suites) {
      const s = suite as Record<string, unknown>;
      for (const spec of (s.specs as unknown[]) ?? []) {
        const sp = spec as Record<string, unknown>;
        const title = String(sp.title ?? "");
        for (const test of (sp.tests as unknown[]) ?? []) {
          const status = String((test as Record<string, unknown>).status ?? "");
          if (status === "skipped") continue;
          out.push({
            title,
            id: caseId(title),
            failed: status !== "expected",
          });
        }
      }
      visit((s.suites as unknown[]) ?? []);
    }
  };
  visit(((report as Record<string, unknown>)?.suites as unknown[]) ?? []);
  return out;
}

/** A test's case id is the `TB-nnn` its title starts with; without one, the title stands in. */
function caseId(title: string): string {
  return /^(TB-\d{3})\s/.exec(title)?.[1] ?? title;
}

// Playwright's own CLI script, run by this node like the app is. The `.bin/playwright` shim is a shell
// script, and on Windows it cannot be spawned without a shell (spawnSync answers ENOENT).
const PLAYWRIGHT_CLI = createRequire(import.meta.url).resolve("@playwright/test/cli");

function runUnit(file: string, port: number, reportPath: string): { code: number; out: string } {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PORT: String(port),
    // A command-line reporter replaces the config's reporters and writes its JSON to stdout, which
    // also carries Playwright's own progress output. Naming a file keeps the two apart.
    PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
  };
  const result = spawnSync(
    process.execPath,
    [PLAYWRIGHT_CLI, "test", file, "--reporter=json", "--retries=0", "--workers=1"],
    { env, encoding: "utf8", timeout: 300_000 },
  );
  return {
    code: result.status ?? -1,
    out: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

// --- classification -------------------------------------------------------------------------------

function describeVersion(v: Version): string {
  return `${v.version} (build ${v.build})`;
}

export function classify(units: UnitResult[], declared: Map<string, Declaration>): Finding[] {
  const findings: Finding[] = [];
  for (const unit of units) {
    for (const outcome of unit.failed) {
      const declaration = declared.get(outcome);
      if (declaration) {
        findings.push({
          className: "KNOWN RED",
          id: outcome,
          unit: unit.file,
          test: outcome,
          advice: `${declaration.reason} (source: ${declaration.source}; declared ${declaration.declared})`,
        });
      } else if (unit.changed) {
        findings.push({
          className: "INCONCLUSIVE",
          id: outcome,
          unit: unit.file,
          test: outcome,
          advice:
            `rerun this unit on one build: the version under test moved from ` +
            `${describeVersion(unit.before)} to ${describeVersion(unit.after)} during this unit`,
        });
      } else {
        findings.push({
          className: "NEW RED",
          id: outcome,
          unit: unit.file,
          test: outcome,
          advice:
            `treat as a regression until reproduced otherwise on the same build ` +
            `(${describeVersion(unit.before)})`,
        });
      }
    }
    for (const id of unit.passed) {
      if (!declared.has(id)) continue;
      const base =
        "verify on one build, then remove the declaration by hand; " +
        "the gate never rewrites known-reds.yml";
      findings.push({
        className: "WENT GREEN",
        id,
        unit: unit.file,
        test: id,
        advice: unit.changed
          ? `${base} — across a redeployment: not evidence of a fix ` +
            `(${describeVersion(unit.before)} to ${describeVersion(unit.after)})`
          : base,
      });
    }
  }
  return findings;
}

export function exitCodeFor(findings: Finding[]): number {
  if (findings.some((f) => f.className === "NEW RED")) return 1;
  if (findings.some((f) => f.className === "INCONCLUSIVE")) return 2;
  return 0;
}

// --- output ---------------------------------------------------------------------------------------

const ORDER: Finding["className"][] = ["NEW RED", "INCONCLUSIVE", "KNOWN RED", "WENT GREEN"];
const COUNTS_AS_FAILURE: Record<Finding["className"], string> = {
  "NEW RED": "counts as a failure",
  INCONCLUSIVE: "counts as a failure",
  "KNOWN RED": "not counted as a failure",
  "WENT GREEN": "reported only",
};

function table(findings: Finding[], titles: Map<string, string>): string {
  const rows = findings.map((f) => [f.id, f.unit, titles.get(`${f.unit}|${f.id}`) ?? f.test]);
  const head = ["case", "unit", "test"];
  const width = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (r: string[]) => `  ${r.map((c, i) => c.padEnd(width[i])).join("  ")}`.trimEnd();
  const out = [line(head), `  ${width.map((w) => "-".repeat(w)).join("  ")}`];
  for (const [i, row] of rows.entries()) {
    out.push(line(row));
    out.push(`      advice: ${findings[i].advice}`);
  }
  return out.join("\n");
}

export function formatResult(
  base: string,
  specDirs: string[],
  knownRedsPath: string,
  declarations: number,
  units: UnitResult[],
  findings: Finding[],
  titles: Map<string, string>,
  code: number,
): string {
  const out: string[] = [
    `Gate — Acme Tasks on ${base}`,
    `units: ${units.length} spec file(s) under ${specDirs.join(", ")}, one at a time in file-name order`,
    `known reds: ${knownRedsPath} (${declarations} declaration(s))`,
    "",
  ];
  for (const [i, unit] of units.entries()) {
    const moved = unit.changed ? "  <-- version under test CHANGED during this unit" : "";
    out.push(
      `unit ${i + 1}/${units.length}  ${unit.file}` +
        `\n    version ${describeVersion(unit.before)} -> ${describeVersion(unit.after)}${moved}` +
        `\n    ${unit.passed.length} passed, ${unit.failed.length} failed`,
    );
  }
  out.push("");

  for (const className of ORDER) {
    const group = findings.filter((f) => f.className === className);
    if (group.length === 0) continue;
    out.push(`${className} — ${group.length} (${COUNTS_AS_FAILURE[className]})`);
    out.push(table(group, titles));
    out.push("");
  }

  const count = (c: Finding["className"]) => findings.filter((f) => f.className === c).length;
  out.push(
    `result: ${count("NEW RED")} NEW RED, ${count("INCONCLUSIVE")} INCONCLUSIVE, ` +
      `${count("KNOWN RED")} KNOWN RED, ${count("WENT GREEN")} WENT GREEN`,
  );
  out.push(`exit ${code}`);
  return `${out.join("\n")}\n`;
}

// --- the run --------------------------------------------------------------------------------------

async function main(): Promise<number> {
  const knownRedsPath = process.env.KNOWN_REDS ?? DEFAULT_KNOWN_REDS;
  const specDirs = process.env.GATE_SPECS ? [process.env.GATE_SPECS] : DEFAULT_SPEC_DIRS;
  const port = Number(process.env.PORT ?? 18430);
  const base = `http://localhost:${port}`;

  const declarations = readKnownReds(knownRedsPath);
  const declared = new Map(declarations.map((d) => [d.id, d]));

  const files = specFiles(specDirs);
  if (files.length === 0) {
    throw new InputError(`no *.spec.ts under ${specDirs.join(", ")}`);
  }

  // The scratch directory and the app are both cleaned up in the finally below. startApp() is inside
  // the try on purpose: it can throw (the app not answering is an input error), and when it did, an
  // earlier version left the scratch directory behind because the finally only covered the unit loop.
  const scratch = mkdtempSync(join(tmpdir(), "rgd-gate-"));
  const units: UnitResult[] = [];
  const titles = new Map<string, string>();
  let app: ChildProcess | undefined;

  try {
    app = await startApp(port, base);
    for (const [i, file] of files.entries()) {
      const before = await readVersion(base);
      const reportPath = join(scratch, `unit-${i + 1}.json`);
      const run = runUnit(file, port, reportPath);
      const after = await readVersion(base);

      if (!existsSync(reportPath)) {
        throw new InputError(
          `the report for ${file} was not written to ${reportPath} ` +
            `(playwright exited ${run.code}): ${run.out.trim().split("\n").slice(-3).join(" / ")}`,
        );
      }
      let report: unknown;
      try {
        report = JSON.parse(readFileSync(reportPath, "utf8"));
      } catch (err) {
        throw new InputError(`the report for ${file} could not be read: ${(err as Error).message}`);
      }

      const outcomes = outcomesFromReport(report);
      // Playwright writes a report with `suites: []` and exits 1 when it finds no test in the file it
      // was handed. Reading that as a clean unit would let the gate report green for a unit that never
      // ran — the worst thing a gate can do — so it is an input error: the file was named, so it must
      // contain a test.
      if (outcomes.length === 0) {
        throw new InputError(
          `the unit ${file} ran no test at all (playwright exited ${run.code}): ` +
            `${run.out.trim().split("\n").slice(-3).join(" / ")}`,
        );
      }
      for (const o of outcomes) titles.set(`${file}|${o.id}`, o.title);
      units.push({
        file,
        before,
        after,
        changed: before.version !== after.version || before.build !== after.build,
        passed: outcomes.filter((o) => !o.failed).map((o) => o.id),
        failed: outcomes.filter((o) => o.failed).map((o) => o.id),
      });
    }
  } finally {
    if (app) await stopApp(app);
    rmSync(scratch, { recursive: true, force: true });
  }

  const findings = classify(units, declared);
  const code = exitCodeFor(findings);
  const text = formatResult(
    base,
    specDirs,
    knownRedsPath,
    declarations.length,
    units,
    findings,
    titles,
    code,
  );
  process.stdout.write(text);

  mkdirSync("reports", { recursive: true });
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    join("reports", "gate.json"),
    `${JSON.stringify(
      {
        app: base,
        specDirs,
        knownRedsPath,
        declarations: declarations.length,
        units,
        findings,
        counts: {
          "NEW RED": findings.filter((f) => f.className === "NEW RED").length,
          INCONCLUSIVE: findings.filter((f) => f.className === "INCONCLUSIVE").length,
          "KNOWN RED": findings.filter((f) => f.className === "KNOWN RED").length,
          "WENT GREEN": findings.filter((f) => f.className === "WENT GREEN").length,
        },
        exitCode: code,
      },
      null,
      2,
    )}\n`,
  );
  return code;
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      const input = err instanceof InputError;
      process.stderr.write(
        `gate: ${input ? "input error" : "failed"}: ${(err as Error).message}\n`,
      );
      if (!input) process.stderr.write(`${(err as Error).stack ?? ""}\n`);
      // An input error is exit 3: the gate could not judge, which is not the same as a red.
      process.exit(3);
    },
  );
}
