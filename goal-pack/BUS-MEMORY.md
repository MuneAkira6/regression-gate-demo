# Bus memory — regression-gate-demo

**This is a complement, not a summary.** Anything in PROGRESS.md, BUS-LOG.md or the goal brief does not
belong here. When a later measurement corrects an entry, come back and rewrite it. Marks: 🆕 new ·
✅ verified · 🔴 warning · ~~struck~~ no longer true.

## Environment facts across goals

- ✅ Re-measured by the bus after G0 (2026-09-30): Node `v24.19.0`, `pnpm --version` `11.28.0`,
  `pnpm exec playwright --version` `Version 1.62.1`, all `exit=0`. `pnpm list --depth 0` shows exactly
  the six devDependencies at the versions the brief predicted; `pnpm-lock.yaml:15` pins
  `specifier: 1.62.1`.
- 🆕 Playwright is pinned at 1.62.1 because 1.63.0 refuses this Ubuntu 20.04 host
  (`Playwright does not support chromium on ubuntu20.04-x64`). 1.62.1's Chromium (headless shell
  151.0.7922.34) is already installed in the directory `PLAYWRIGHT_BROWSERS_PATH` names.
- ✅ `$PLAYWRIGHT_BROWSERS_PATH` is `~/portfolio-runs/ms-playwright` and holds exactly
  three entries: `chromium-1234`, `chromium_headless_shell-1234`, `ffmpeg-1011`.
- 🆕 Ports 18430–18439 were free; other services listen on this machine and must not be touched.
- ✅ `PORT` is plumbed end to end: `PORT=18431 pnpm app` printed
  `Acme Tasks listening on http://localhost:18431 (version 1.4.0)` and answered there;
  `playwright.config.ts:9` reads `process.env.PORT`. A gate running a unit on its own port will work.
- 🆕 An HTTPS proxy is configured through environment variables. Nobody unsets or prints them.
- 🆕 The run uses its own Claude configuration directory, so no user-level skills, memory or MCP servers
  are loaded. That is intended.
- ✅ `pnpm test` exits 1 with `No test files found` until `test/` exists (it arrives in G1). So the
  brief's post-compaction step "run `pnpm test` once to confirm the workspace is healthy" is misleading
  before G1 lands its first self-test: use `pnpm lint`, `pnpm typecheck` and `pnpm e2e` instead.

## Doubts to re-check

- 🔴 **The self-tests fall outside both quality checks.** The contract puts them in `test/*.test.ts`,
  but the given `tsconfig.json` includes `["apps","tools","tests","playwright.config.ts"]` and the given
  `biome.json` includes `["apps/**","tools/**","tests/**","playwright.config.ts"]` — `tests` ≠ `test`.
  Measured: `pnpm exec tsc --noEmit --listFiles` lists only `apps/sample-app/server.ts`,
  `tests/ui/home.spec.ts`, `playwright.config.ts`; `biome check vitest.config.ts` says
  `Checked 0 file`. So from G1 on, `pnpm lint` and `pnpm typecheck` are **vacuously clean** over the
  self-test suite and over `vitest.config.ts`. The G1 and G2 check rows that ask for clean lint and
  typecheck must say so, or they measure nothing. Fixing it means editing a given configuration file:
  SCOPE.md allows that through "Contract changes", the brief's red line 6 forbids it. I ruled "record,
  do not edit" for G1 (below); if G2's self-tests grow enough that the gap starts hiding real errors,
  escalate for a human ruling instead of widening it. **After G1:** the worker did exactly that — the
  row claims cleanliness only for the ten files `tsc --listFiles` actually loads, names the two it does
  not cover, and writes the gap up as incidental finding 1 with the one-line fix. I re-measured: the ten
  files are loaded, `test/stable-read.test.ts` and `vitest.config.ts` are not. G2 will add more `test/`
  files, so the uncovered surface grows; re-read the row then and decide whether a human should rule.
- 🔴 **`pnpm e2e` exits 1 by design, and two G3 rows assume it does not.** The declared red TB-011 makes
  `pnpm e2e` exit 1 on a healthy repository; only the gate tolerates a declared red. But SCOPE.md's
  「動かし方」 is one `&&` chain — `pnpm i && … && pnpm test && pnpm e2e && pnpm gate` — which stops at
  `pnpm e2e` and never reaches the gate, and AC-15 asks for that chain to exit 0. The CI workflow
  (AC-13) has the same problem: an `e2e` step that always fails fails the job. This needs settling in
  G3, and there are sanctioned routes — the AS-BUILT rewrite marks differences from the frozen contract
  with a reason, and a changed plan needs its reason written in PROGRESS.md first. Do not let it be
  "solved" by weakening TB-011 or by giving `pnpm e2e` a passing exit code.
- 🆕 `catalog/cases.csv` TB-017 expects a created task to come back with `status` `open`, which is
  sensible but is **not** in SCOPE.md's route table — the contract does not say what status a new task
  gets. G3's AS-BUILT should state it. Small, but it is an expectation the frozen contract does not fix.
- 🆕 TB-023 (`POST /__admin/deploy`) is the one `n/a` case, so the deploy hook is outside the coverage
  denominator. The materials say a row taken out of the denominator must be doubted later: the reason
  given (a test hook, not product surface) holds, and the hook is not left unexercised — I curled it in
  this review and G2's INCONCLUSIVE fixture must drive it for real. Re-check that in G2.
- 🆕 `pnpm install` reported `Packages: +45`; `node_modules/.pnpm` holds 46 entries, one of which is the
  store's own `node_modules` directory. Consistent, not a discrepancy — noted so nobody re-litigates it.

- ✅ ~~The coverage percentage does not measure the suite~~ — **fixed and verified, 2026-09-30.** The
  defect was `tally()` counting the sheet's `automation` column instead of the cases a test claims, so
  the figure could not fall; I found it by running the real tool in a planted mini-repository, where it
  printed `home P0 2 cases 2 automated 100.0%` in the same output as `gaps ...: TB-002`. Now
  `tools/coverage-report.ts:167` reads
  `const automated = cases.filter((c) => planned(c) && testIds.has(c.id)).length;` and the same planted
  input gives `home P0 2 cases 1 automated 50.0%` with the overall line falling 66.7% → 33.3%; covering
  the gap puts both back. The real sheet is unchanged (`23 21 1 1 95.5%`), so the agreement of the
  measured and planned counts is now a fact about the suite. The worker settled the open question against
  `materials/practice.md` §2 (「書いたテストの数ではなく、目録に対して何行を覆っているかを数えます」) rather
  than against my say-so, and recorded it under Contract changes. **Keep for G3:** the AS-BUILT contract
  must carry that decision, because SCOPE.md never defined the column.

## The worker's habits

- ✅ Precise and checkable: every G0 row carries the command, its output and `exit=0`. I recounted three
  of its enumerations (the six devDependencies, the three browser-directory entries, biome's
  "Checked 4 files") and all three held. The `reports/e2e.json` size it quoted (3122 bytes) matched the
  file on disk before I overwrote it — a sign the quoted run was real.
- 🆕 It reports a defect its own change introduced instead of hiding it (the Vitest/Playwright glob
  clash), and puts forward hazards in the Handover rather than leaving them for the reader to find.
- ✅ **After G1 the habit is consistent and unusually strong.** It anticipates the reviewer: it writes the
  reason for a design choice into the source (`tests/ui/tasks.spec.ts:3-7` on why nothing asserts
  "exactly five rows"), it keeps a row narrow rather than overclaiming (the lint row), and it books its
  own unlisted files under Contract changes instead of slipping them in. Nine of nine G1 rows survived
  my re-run unchanged; every enumeration I recounted matched.
- ✅ After G2 the habit holds under a much harder goal: it found a defect of its own (a unit that ran no
  test was booked as green, `exit 0` instead of `3`), fixed it in-goal, and wrote the mechanism into the
  source at `tools/gate.ts:399-408`. It resolved all five traps the bus handed it and recorded each
  measurement under Contract changes. It also did the thing I asked and most workers will not: it said
  plainly that the lint/typecheck gap had grown past what it could absorb, instead of letting a clean
  `Checked 22 files` imply coverage it does not have.
- 🔴 Habit to watch: the blind spot is **what a self-test asserts**, not whether it runs. Every gate
  self-test is a real spawn of the real tool, and yet the coverage gap test asserts only the gap line and
  the exit code, never that the percentage moved — which is the one way that tool's headline number can
  lie. When a row says "its tests plant X and see exit 1", check what else should have moved.
- 🔴 Habit to watch: absence-claims are argued, not observed ("no apt or other system-package command
  was run"). Acceptable here, but for a row that turns on an absence, ask for the positive observation.

## Proven along the way — later goals may cite

- The G0 environment rows (Node, pnpm, Playwright, browser directory) are verified twice, by the worker
  and by me. Later goals may cite them instead of re-running the version commands.
- ✅ The build id is `randomBytes(6)` evaluated once per process (`server.ts:43`), so **every restart of
  the app changes `build` without any deploy**. I saw `9cfd1508084c` (worker's run) and `df8d299375c3`
  (mine), and the value was stable across two requests inside one process. Consequence for G2: the gate
  must start its app once and keep it up for the whole run, or a restart between two `/version` reads
  will look exactly like a redeployment and manufacture INCONCLUSIVE.
- ✅ **The today counter's ramp is client-side JavaScript** (`server.ts:99-113`), so `curl` always shows
  `data-testid="today-counter">0`. Raw reads for the in-between values must come from a browser page.
- ✅ The seed gives 4 open tasks of 5 (`server.ts:22-30`), so the ramp is `600/4 = 150 ms` per step and
  renders 0,1,2,3,4. With `intervalMs = 100` three consecutive reads cannot fall inside one 150 ms step,
  which is why `n = 3` is safe here. The margin depends on the open-task count: recompute it if the seed
  or `COUNTER_RAMP_MS` ever changes. With all 5 open the step would be 120 ms, still above 100 ms.
- ✅ **A/B I ran in the OS temp directory, two genuinely different configs, one file named on the CLI:**
  with `testIgnore: ["**/fixtures/**"]`, `playwright test <a fixtures spec>` fails
  `Error: No tests found.` `exit=1`; with `testIgnore` deleted and nothing else changed, the same file
  runs `1 passed`. The contract asks for both that `testIgnore` **and** a gate that runs
  `tests/fixtures` through `GATE_SPECS`, so G2 cannot have both without making `testIgnore` conditional
  (drop it when `GATE_SPECS` is set). That is a change to a file G0 froze, but `playwright.config.ts` is
  a deliverable, not a given file, so no red line is involved — it belongs in Contract changes.
- ✅ **The counter test is not flaky on this host, measured not assumed.** `TB-002` pins the first raw
  read to `"0"`, which is timing-dependent in principle: the ramp's first tick is `setTimeout(tick,
  stepMs)`, so the element holds `"0"` for 150 ms (4 open tasks) while `page.goto` plus one
  `textContent` round trip costs single-digit milliseconds. I ran `tests/ui/home.spec.ts` five times in
  a row: 5/5 gave the series `["0","1","2","3","4"]` and `readStable(n=3) returned "4"`. In the full
  suite the open count is 7 by the time the home page is read (the API cases create tasks), so the step
  is 86 ms and the series is `["0",…,"7"]` — still caught from `"0"`. The margin shrinks as the open
  count grows; if a later goal adds cases that create many tasks, re-measure.
- ✅ **The whole route table behaves as the contract says** — I curled all of it myself on one process
  (port 18432): `?sort=due` gives `2026-09-28, 2026-10-02, 2026-10-05, no due date, no due date`;
  `/tasks/999` is `[404] text/html` while `/api/tasks/999` is `[404] {"error":"not found"}`; both a
  missing and a whitespace `title` give `[400] {"error":"title is required"}`; `PATCH` with
  `status=archived` gives `[400] {"error":"status must be open or done"}` and an unknown id `[404]`;
  `POST /api/notifications/test` gives `[503] {"error":"mail transport unavailable"}`;
  `POST /__admin/deploy {"version":"1.5.0"}` moved `/version` from
  `{"version":"1.4.0","build":"002903cb5182"}` to `{"version":"1.5.0","build":"e66e4ea70c14"}` on one
  process with no restart, and a non-semver body gives `[400] {"error":"version must be a semver"}`.
  Later goals may cite this instead of re-curling.
- ✅ **The expected coverage table, computed by the bus from `catalog/cases.csv` independently of any
  tool the worker writes.** G2's `pnpm coverage` must reproduce these numbers; if it does not, one of
  the two is wrong and it must be run down, not smoothed over.

  | domain | priority | cases | automated | manual | n/a | coverage |
  |---|---|---|---|---|---|---|
  | api | P0 | 7 | 7 | 0 | 0 | 100.0% |
  | api | P1 | 5 | 4 | 0 | 1 | 100.0% |
  | home | P0 | 2 | 2 | 0 | 0 | 100.0% |
  | home | P1 | 1 | 0 | 1 | 0 | 0.0% |
  | notifications | P0 | 1 | 1 | 0 | 0 | 100.0% |
  | notifications | P1 | 1 | 1 | 0 | 0 | 100.0% |
  | tasks | P0 | 4 | 4 | 0 | 0 | 100.0% |
  | tasks | P1 | 2 | 2 | 0 | 0 | 100.0% |
  | **overall** | | **23** | **21** | **1** | **1** | **95.5%** (denominator 22 = 23 − 1 n/a) |

- ✅ **The suite is deliberately order-dependent-proof, and that matters for the gate.** The contract has
  no delete, `tests/api` sorts before `tests/ui`, and TB-017/TB-019/TB-020 create tasks that live as
  long as the process, so the app's data accumulates across spec files. Every assertion in
  `tests/ui/tasks.spec.ts` and `tests/api/tasks.spec.ts` is therefore relational (these titles are
  present, undated last, only-open in the open filter) and the API cases create their own tasks instead
  of mutating the seeded five — `tests/ui/tasks.spec.ts:3-7` says so in a comment. Do not let a later
  goal "tighten" any of these into an absolute count: it would go red on the second consecutive run and
  under the gate, which runs every unit against one long-lived app.
- 🔴 `tests/api/version.spec.ts:15` asserts `version` is exactly `"1.4.0"`. So any gate run that deploys
  must not share an app with the real suite, and inside one gate run a fixture that deploys changes the
  version for **every later unit** of that run.
- ✅ The Vitest/Playwright clash the worker fixed is real, not assumed: with a probe config in the OS
  temp directory whose `include` is `tests/**/*.spec.ts`, Vitest fails on `home.spec.ts:6` with
  `1 failed (1)`, `Tests no tests`. `vitest.config.ts` earns its place.

## What the bus verified itself

**After G0 (2026-09-30).** I ran, in this order: `goal-bus.sh --status` (unjudged G0: 0; lock held;
current G1); the three version commands; `pnpm lint` (`Checked 4 files in 7ms. No fixes applied.`,
`exit=0`) and `pnpm typecheck` (`exit=0`, no output); a listener check on 18430–18439 before and after
everything (`(nothing listening on 18430-18439)`); `PORT=18431 pnpm app` with `curl` against
`/version` twice (`{"version":"1.4.0","build":"df8d299375c3"}` both times, semver true, 12 hex true),
`/` (`<title>Acme Tasks</title>`, `<h1>Acme Tasks</h1>`, counter `0`) and the status codes
`/ 200`, `/version 200`, `/tasks 404`, `/api/tasks 404`, `/nope 404`; `pnpm e2e` myself
(`✓ 1 tests/ui/home.spec.ts:6:1 › TB-001 opens the home page (122ms)`, `1 passed (1.7s)`, `exit=0`);
`pnpm test` (`No test files found`, `exit=1`); the full `git diff` of SCOPE.md (one line pair,
`DRAFT.` → `FROZEN 2026-09-30.`) and `git diff --stat` over every given file (empty); `git log -1`
(still `acf3581`, branch `main`, no commit made); `tsc --listFiles` and per-file `biome check` to map
the lint and typecheck scope; the two probes described above.

**After G1 (2026-09-30).** I ran: the sheet through my own `csv.DictReader` audit (23 cases; domain
{home 3, tasks 6, notifications 2, api 12}; priority {P0 14, P1 9}; automation {ui 10, api 11, manual 1,
n/a 1}; no bad id, domain, priority or automation value; no duplicate id; no empty cell; 0 CR bytes) and
my own join of the sheet against the test titles parsed out of the spec files (21 ui/api cases, 21 tests,
no gap, no orphan, no duplicate, none in the wrong directory) — every figure matched the worker's;
`pnpm test` (`Tests  8 passed (8)`, `exit=0`); `pnpm lint` (`Checked 12 files in 15ms`, `exit=0`);
`pnpm typecheck` (`exit=0`) plus `tsc --listFiles` to confirm the ten covered files and the two
uncovered ones; `pnpm e2e` in full (`Running 21 tests using 1 worker`, `1 failed` / `20 passed (9.7s)`,
`exit=1`, the only `✘` being `TB-011`, with `Expected: "Test email sent"` /
`Received: "Could not send the test email: mail transport unavailable"`);
`tests/ui/home.spec.ts` five times over for the flake probe; the full route sweep by curl on port 18432;
`git status --short`, `git diff --stat` over every given file (empty) and over SCOPE.md (still the one
freeze line); a listener check before and after each probe. I read every spec file, `tools/stable-read.ts`
and `tests/controls.ts` line by line.

**After G2 (2026-09-30) — the goal the runbook says to look at in person.** I ran `pnpm coverage`
(exit 0; all eight buckets and the overall line equal my own precomputed table, cell for cell),
`pnpm exec playwright test --list` with `GATE_SPECS` unset (`Total: 21 tests in 6 files`, 0 fixture
lines — the config change did not leak fixtures into `pnpm e2e`), `pnpm test` (`Tests 32 passed (32)`),
`pnpm lint` (`Checked 22 files`), `pnpm typecheck`, and `pnpm gate` on the real suite
(`result: 0 NEW RED, 0 INCONCLUSIVE, 1 KNOWN RED, 0 WENT GREEN` / `exit 0`, one build id
`7950c3d3e3fc` across all six units, unit counts summing to the 21 tests of `pnpm e2e`). I read
`tools/gate.ts` and `tools/coverage-report.ts` in full.

**Then I broke the gate on purpose**, with my own declaration files under `mktemp -d` and the
repository's fixtures untouched, on ports 18437–18439 — an A/B in every case, one variable at a time:
the known-red fixture with `TB-902` declared gives `KNOWN RED` / `exit 0`, and with the declaration
removed and nothing else changed gives `NEW RED` / `exit 1` with the on-the-same-build advice; the
deploying fixture undeclared gives `INCONCLUSIVE` / `exit 2` with `1.4.0 (build 225df6b99857) -> 9.9.9
(build c27bb8d8ca5a)`, and the same fixture with that id declared gives `KNOWN RED` / `exit 0` —
declared beats a moved build, which is what the contract's conditions say and which the worker had not
reported; `went-green-across-deploy` gives `WENT GREEN` / `exit 0` with the addendum verbatim; the
`mixed` directory in one run gives one `NEW RED` and one `INCONCLUSIVE` and `exit 1`, so NEW RED
outranks INCONCLUSIVE. Seven input errors all exited 3 and named the offender: malformed YAML, an entry
with no `declared` (the fourth key, which AC-10 never covered), an entry that is a string not a mapping,
a missing file, a `GATE_SPECS` directory with no spec, and the spec file containing no test (the defect
the worker found and fixed — confirmed fixed). An empty-but-present declarations file is correctly not
an input error: `0 declaration(s)` and the fixture red becomes a `NEW RED`. `reports/gate.json` matched
the printed table for my own run. `known-reds.yml` was untouched by every run (same md5, mtime 11:43,
before all of them), and no self-test fabricates a Playwright report — `test/gate.test.ts:27` spawns the
real gate with `spawnSync(process.execPath, [GATE], …)` and `test/coverage-report.test.ts:47` spawns the
real report in a planted `mkdtemp` repository. I also broke the coverage report in a planted
mini-repository, which is how I found the `automated` defect above.

**After the G2 re-review (2026-09-30).** I re-ran `pnpm coverage` (the same eight buckets and
`overall 23 21 1 1 95.5%`, `exit 0` — unchanged, as I had predicted), the planted mini-repository that
exposed the defect (now `home P0 2 cases 1 automated 50.0%` beside `gaps ...: TB-002`, overall
66.7% → 33.3%, `exit 1`) and its control (covering the gap restores 100.0% / 66.7%; the orphan alone
still exits 1 without moving a figure, which is right — an orphan is outside the denominator).
`pnpm test` `Tests 34 passed (34)`; `pnpm lint` `Checked 22 files`; `pnpm typecheck` silent;
`pnpm gate` `1 KNOWN RED`, `exit 0`, and `reports/gate.json` holding the real suite's six units. Then my
own mutation test, which is the one the worker could not do for me: I copied `tools/coverage-report.ts`
and `test/coverage-report.test.ts` into a temp directory with a symlinked `node_modules`, reinstated the
defect **in the copy only**, and ran the worker's own self-tests against it — the three figure-asserting
cases failed with `AssertionError: … to match /api\s+P0\s+2\s+1\s+0\s+0\s+50.0%/`. Three further
failures in my replica were my harness's fault, not the mutation's: those cases read the real
`catalog/cases.csv` relative to the working directory, which my replica does not have. The repository file
was never touched (line 167 still the fixed form, no mutation marker anywhere under `tools/`, `test/`,
`apps/` or `tests/`).

**After G3 (2026-09-30) — the closing review.** I read the whole README, `PUBLISHING.md`,
`.github/workflows/ci.yml` and the AS-BUILT contract. I checked the seven README sections and their
order, that all six 「設計」 reasons SCOPE.md demands have their own subsection, and that the signature
line is verbatim. I re-derived every figure the README quotes and each matched a run of my own:
`pnpm test` 34, `pnpm e2e` 21 with `1 failed`/`20 passed` and exit 1, `pnpm gate` 6 units and
`1 KNOWN RED` exit 0, `pnpm coverage` the eight buckets and `23 21 1 1 95.5%`, `pnpm lint`
`Checked 22 files`, `pnpm typecheck` silent. I grepped the publishable files
(`README.md`, `PUBLISHING.md`, `ci.yml`, `known-reds.yml`, `catalog/cases.csv`) for host paths, the
account name, proxy variables, credentials and session ids: none. `git diff --stat -- LICENSE` empty.
I verified the gate's scratch-leak fix in the source (`tools/gate.ts:376-383`: `startApp()` is now inside
the `try`, with `app` declared before it). I ran my own verdict census with my own table parser — 35 rows,
all PASS, none empty — and cross-checked it against the hooks' `unjudged: 0`. I checked the AS-BUILT
differences list against the nine I had been tracking: all nine are there (D1–D7, D9, D10) plus ten more
the worker found that I had not enumerated. I read `/usr/local/bin` to verify change-ledger row 13, and
I counted the host-detail occurrences in each `goal-pack` file myself.

**My own environment changes:** my `pnpm e2e` run rewrote `reports/e2e.json`
(md5 `60840af…` → `bc434bf…`; `reports/` is gitignored and the file is regenerated by every run, so
there is nothing to restore). Two probe directories under `mktemp -d`, both removed. One probe of mine
left the app running while my cleanup command timed out; I checked afterwards and nothing was listening
on 18430–18439 and no `server.ts` process survived. In the G1 review I started an app on 18432 with
`node apps/sample-app/server.ts` directly rather than through `pnpm app`, because a `kill -TERM` on the
pnpm wrapper does not reach the server; killing the node process by pid works and left the port free.
My `pnpm e2e` run also rewrote `reports/e2e.json` and `test-results/`, both gitignored and regenerated by
every run. In the G2 review my nine probe gate runs overwrote `reports/gate.json`, so I re-ran
`pnpm gate` afterwards and read the file back to confirm it holds the real suite's result again
(`['tests/ui','tests/api']`, `KNOWN RED: 1`, `exit 0`) — the same housekeeping the worker had to do, and
a sign the file is a shared resource that any gate run claims. Probe directories under `mktemp -d`, all
removed; ports clear afterwards; no app process left. I edited no file in the repository other than this
memory.

## Rulings the bus made

- **G0 PASS** on 2026-09-30, all seven rows, six of them re-run by me.
- `vitest.config.ts` is accepted although the Deliverables table does not list it: it adds a file rather
  than editing a given one, the reason is recorded under Contract changes, and without it `pnpm test`
  cannot run at all. G3's AS-BUILT contract must list it, with the reason.
- For G1: **record the lint/typecheck coverage gap, do not edit a given configuration file to close it.**
  The brief's red line 6 outranks convenience, and an incidental finding keeps the decision with the
  human who owns it.

- **G1 PASS** on 2026-09-30, all nine rows. I re-ran the suite, the self-tests, lint, typecheck and the
  whole route table, and recounted the sheet with my own parser.
- `tests/controls.ts` is accepted for the same reason as `vitest.config.ts`: it adds a file rather than
  editing a given one, the reason (no `resolveJsonModule` in the given `tsconfig.json`) is recorded
  under Contract changes, it sits under `tests/` so both checks cover it, and it is not a `*.spec.ts`,
  so neither Playwright nor the coverage report's title scan can mistake it for a test. G3's AS-BUILT
  must list both files.
- A correction to the worker's change-set row, for whoever reads the ledger: `goal-pack/BUS-MEMORY.md` is
  written by **the bus**, not by the goal-bus hook. The hook writes `BUS-LOG.md` and `BUS-REVIEWS.md`.
- The Handover section still holds only G0's three items, two of which G1 has already settled (`pnpm
  test` is green; the app now serves every route). It is meant to be filled at the end, so this is not a
  row violation — but G3 must rewrite it rather than leave resolved items standing.

- **G2 REJECTED once** on 2026-09-30, on one root cause: the coverage percentage counts the sheet's plan
  rather than the suite. Everything else in G2 I verified and it stands — do not re-litigate the other
  nine rows on the re-review; only AC-6, the `pnpm test` count and any quoted output that moves need
  re-judging.
- **The lint/typecheck coverage gap: my ruling stands, and it is now a human's decision to take.** The
  worker escalated it correctly — `test/` is three files and 32 cases, and `test/gate.test.ts` is the
  only automated check that the four classes and four exit codes are right, yet it is neither linted nor
  typechecked because the given `tsconfig.json` and `biome.json` name `tests`, not `test`. I am not
  halting the relay for it: nothing in it is unverified (`pnpm test` runs all 32 green), no row depends
  on the decision, and G3 has honest places to record it. The whole fix is `"test"` in `tsconfig.json`'s
  `include` and `"test/**"` in `biome.json`'s `includes`, which red line 6 puts out of the worker's
  hands. G3 must (a) keep incidental finding 1 current, (b) name the limitation in the AS-BUILT contract
  and in CI, and (c) put it in PUBLISHING.md's pre-publish checklist as an open question for the human —
  that is the page a human reads with the authority to change a given file.
- The gate exits 3 for an unexpected internal error as well as for an input error (`tools/gate.ts:469-475`
  prints `gate: failed:` with a stack, then exits 3). The contract only fixes 3 for input errors, so this
  is not drift, but G3's AS-BUILT should say so: a reader must not read every 3 as "your input was bad".

- **G2 PASS** on 2026-09-30 after one rejection. The fix was the one line I asked for, the real numbers
  did not move, and I confirmed the strengthened assertions can fail by running the worker's own
  `test/coverage-report.test.ts` against a **mutated copy** of the tool in the OS temp directory: the three
  figure-asserting cases go red. Their in-place mutation run reported `3 failed | 11 passed (14)`, which
  matches exactly the three cases my replica showed to be mutation-sensitive.
- **G3 is the last goal: answer DONE after it, not PASS.** Nine differences from the frozen contract are
  known and the AS-BUILT rewrite must carry every one with its reason — (1) `playwright.config.ts` made
  conditional on `GATE_SPECS`; (2) the gate reading each unit's report via `PLAYWRIGHT_JSON_OUTPUT_NAME`
  rather than stdout; (3) `vitest.config.ts` added, plus `fileParallelism: false`; (4) `tests/controls.ts`
  added; (5) the `automated` column defined as a measurement; (6) the gate exiting 3 for an unexpected
  internal error as well as an input error; (7) a created task defaulting to `status: open`, which the
  route table never fixed; (8) `pnpm lint` and `pnpm typecheck` not covering `test/**` or
  `vitest.config.ts`; (9) whatever G3 settles about `pnpm e2e` exiting 1 inside the README's `&&` chain
  and in CI. Check the AS-BUILT against this list and against the Contract changes table; a silently
  dropped difference is the failure mode here.

- **G3 PASS and the run is DONE** on 2026-09-30: 35 rows across four goals, all PASS, one rejection in
  total (G2's coverage column). My own table parser counts G0 7, G1 9, G2 10, G3 9 = 35 with no row
  unjudged, which matches both the worker's corrected census and the hooks' `unjudged: 0` on all four.
- **The one red line this run crossed, for whoever reads this next.** In G3 the worker ran
  `corepack enable` while verifying the CI commands. That writes to `/usr/local/bin`, which is outside
  the repository, the OS temp directory and the browser directory — red line 3 — and corepack then tried
  to fetch pnpm over the network (red line 7) and failed on `SELF_SIGNED_CERT_IN_CHAIN`, taking `pnpm`
  out entirely until the shims were put back. It was disclosed in full as change-ledger row 13, not
  discovered by me. I verified the restoration myself: `/usr/local/bin/pnpm` and `pnpx` point at
  `../lib/node_modules/pnpm/bin/pnpm.mjs` and `pnpx.mjs`, the same targets as the untouched root-owned
  `pn` and `pnx`; the `yarn`/`yarnpkg` shims corepack added are gone; `pnpm --version` prints `11.28.0`.
  **Residual, needing root and therefore left open:** those two symlinks are now owned by this run's user
  and dated 9月 30 12:21 instead of root and 8月 17 19:28. Functionally identical, and the same ownership
  pattern `node`, `npm`, `npx` and `corepack` on this host already have. The CI workflow now carries a
  comment warning the next reader never to run `corepack enable` on a development machine.
- **A mistake of mine, found by the worker and fixed by me.** `/tmp/tmp.10BVv1xr4S` was mine, not theirs:
  its `app.log` reads `Acme Tasks listening on http://localhost:18431`, which is my G1-review probe, left
  behind when the cleanup command in that same call timed out before its `rm -rf` ran. I had written the
  lesson "a kill that does not return is not a stopped process" into this file and then failed to check
  that the directory itself was gone. Removed in the G3 review. The other one,
  `/tmp/tmp.znicW5B4Sv` (9月 4, a 38 MB `ampel` binary), predates this run by weeks and is not ours; the
  worker was right to report both rather than delete what it could not attribute.
- **A correction the worker made to me, on evidence.** My G3 instructions asserted that `BUS-REVIEWS.md`
  carries this host's absolute paths and session ids. It does not. My own count: `PROGRESS.md` 4 paths,
  `BUS-MEMORY.md` 1, `BUS-LOG.md` 1 UUID, `BUS-REVIEWS.md` none of the three. They measured it and said
  so in the Handover; I was wrong.
- 🔴 **PUBLISHING.md's occurrence table is slightly low and will drift.** It says `ms-playwright` appears
  twice in PROGRESS.md and the account name twice; I count 4 and 3. More importantly the figures cannot
  stay true: the bus appends to `BUS-MEMORY.md` and `BUS-REVIEWS.md` after any such measurement — this
  entry is proof. The decision the human faces is unchanged (publish as-is, redact, or exclude
  `goal-pack/`), and 要判断 3's full-tree scan with a real tool is the actual safeguard, so this is a
  caveat on the table rather than a defect in the checklist.

## Watch closely

- 🔴 Expectations from the contract, never from the code; a test adjusted to the app's behaviour is a
  test that measures nothing. The subtle case in G1: the **UI** test email case expects the email to be
  sent and is therefore red, while `POST /api/notifications/test` answering 503 is itself contracted, so
  an API case asserting 503 is legitimately green. Both expectations come from SCOPE.md.
- 🔴 No sleeps, no retries: a flaky pass hides exactly what this repository is about.
- 🔴 The only declared red is the test email case, and it is declared because the environment has no
  mail transport, not because the product is broken. Any other declaration needs a ruling.
- 🔴 The negative self-tests must be real runs: forged JSON reports do not count, and the INCONCLUSIVE
  case must change the version in the middle of its unit.
- 🔴 `TB-001` was claimed by `tests/ui/home.spec.ts` in G0, before `catalog/cases.csv` existed. G1's
  sheet must give `TB-001` to the home-page case or the coverage report will call it an orphan.
- 🔴 Your own probes stay in the OS temp directory and on ports 18430–18439; stop what you start, and
  check afterwards — a `kill` that does not return is not a stopped process.
