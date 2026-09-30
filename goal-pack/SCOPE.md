# regression-gate-demo — scope and contract (AS-BUILT)

**Contract status: AS-BUILT 2026-09-30.** Written as DRAFT, frozen unchanged as `FROZEN 2026-09-30` in
G0, and rewritten here in G3 to describe what was actually built. Every difference from the frozen text
is listed in [Differences from the frozen contract](#differences-from-the-frozen-contract) with its
reason — that list is the point of this document, and a difference left out of it would be the one
failure it can have. The per-goal record of each change, with the output it was decided on, is in
[PROGRESS.md](PROGRESS.md) under "Contract changes".

A small sample web app, a Playwright regression suite whose test titles carry the ids of a manual test
sheet, a coverage report whose denominator is that sheet, and a quality gate that tells four kinds of
red apart. The rules come from the author's practice, summarised in
[materials/practice.md](materials/practice.md). The sample app is **Acme Tasks**, a fictional task
board.

## Deliverables, as built

| Path | Content |
|---|---|
| `apps/sample-app/server.ts` | the sample app: `node:http` only, no framework, in-memory data |
| `catalog/cases.csv` | the manual test sheet, 23 cases, the denominator of the coverage report |
| `tests/ui/*.spec.ts` | 3 files, 10 UI tests; every title starts with its case id |
| `tests/api/*.spec.ts` | 3 files, 11 API tests with Playwright's `request`, one file per endpoint group |
| `tests/fixtures/` | 8 specs and 5 declaration files used only by the gate's self-tests (ignored by `pnpm e2e`) |
| `tests/controls.json` | N per control for the stable read (`{"today-counter": 3}`) |
| `tests/controls.ts` | reads that file — **added, see D6** |
| `tools/stable-read.ts` | the stable read |
| `tools/coverage-report.ts` | the coverage report |
| `tools/gate.ts` | the quality gate |
| `known-reds.yml` | the declared reds — exactly one entry, TB-011 |
| `test/*.test.ts` | 3 files, 34 Vitest tests for the three tools, including the gate's negative self-tests |
| `playwright.config.ts` | the Playwright configuration below — **changed, see D3** |
| `vitest.config.ts` | scopes Vitest to `test/**` and serialises it — **added, see D5** |
| `README.md`, `PUBLISHING.md`, `.github/workflows/ci.yml` | as described below |

Given and not changed, and none of them was touched: `LICENSE`, `package.json`, `pnpm-workspace.yaml`,
`tsconfig.json`, `biome.json`, `.gitignore`, `.gitattributes` and everything under
`goal-pack/materials/`. `@playwright/test` stayed at 1.62.1.

## Differences from the frozen contract

Nineteen differences. Each is either something the frozen contract left open that had to be decided, or
something it stated that turned out not to work as written.

### D1 — 「動かし方」's `&&` chain no longer contains `pnpm e2e`, and CI's `e2e` step does not fail the job

**Frozen text:** `pnpm i && pnpm exec playwright install chromium && pnpm test && pnpm e2e && pnpm gate`.

**As built:** `pnpm i && pnpm exec playwright install chromium && pnpm test && pnpm gate`, with
`pnpm e2e` documented on its own line beside it and its `exit 1` explained. In CI the `e2e` step is
kept and still runs, with `continue-on-error: true`.

**Reason.** `pnpm e2e` exits 1 on a healthy repository, because TB-011 is a declared red and the raw
suite has no notion of a declaration — only the gate has. `&&` therefore stops at `pnpm e2e` and never
reaches `pnpm gate`, the one command that can tell a declared red from a new one, so the chain as
written could never succeed; in CI a step that always fails would leave a healthy repository red for
ever. The three alternatives were all worse: weakening TB-011 deletes the only signal the test-email
feature does not work, giving `pnpm e2e` a passing exit code makes the measuring side lie, and dropping
it silently leaves a reader unable to run the raw suite. Nothing goes unexecuted — `pnpm gate` runs the
same 6 spec files and the same 21 tests, one file per unit. What changed is only which exit code is the
verdict, and the README says so.

### D2 — the coverage report's `automated` column is a measurement, not the sheet's plan

**Frozen text:** "per domain × priority: cases, automated, manual, n/a, and coverage = automated ÷
(cases − n/a)" — without defining `automated`.

**As built:** a case counts as automated when the sheet says `ui` or `api` **and** a test claims its id.

**Reason.** `materials/practice.md` §2 settles it: 「書いたテストの数ではなく、目録に対して何行を覆って
いるかを数えます」 — the figure counts how many rows of the sheet are covered. Under the other reading
the percentage is a restatement of the CSV and can never fall, which was not theoretical: the first
implementation printed `home P0  2 cases  2 automated  100.0%` in the same output as
`gaps ...: TB-002`. On the real sheet the figures are unchanged, because all 21 `ui`/`api` cases do
have a test.

### D3 — `playwright.config.ts` is conditional on `GATE_SPECS`

**Frozen text:** `testDir` `tests`, `testIgnore` the fixtures.

**As built:** `testDir: gateSpecs ?? "tests"` and `testIgnore: gateSpecs ? [] : ["**/fixtures/**"]`.

**Reason.** Naming a file on the command line does not override `testIgnore`: with the ignore in place,
`playwright test tests/fixtures/<x>.spec.ts` dies with `Error: No tests found.` and exit 1. The gate
could therefore never run the fixtures that `GATE_SPECS` is contracted to point it at. With `GATE_SPECS`
unset the behaviour is identical to the frozen configuration — `playwright test --list` still reports
`Total: 21 tests in 6 files` and no fixture.

### D4 — the gate reads each unit's report from a file, not from stdout

**Frozen text:** the unit command is `playwright test <file> --reporter=json --retries=0 --workers=1`.

**As built:** that command, with `PLAYWRIGHT_JSON_OUTPUT_NAME` pointing at a per-unit file in a
`mkdtemp` scratch directory the gate removes in a `finally` block.

**Reason.** A command-line reporter replaces the config's reporters, so the JSON goes to stdout and
`reports/e2e.json` is not written. That stdout also carries other output — with the file set, it began
`[WebServer] $ node apps/sample-app/server.ts` followed by a progress reporter — so parsing it would be
unsafe.

### D5 — `vitest.config.ts` added, with `fileParallelism: false`

**Not in the frozen Deliverables table.**

**Reason.** Vitest's default glob includes `**/*.spec.ts`, so `pnpm test` swept in the Playwright specs
and failed on import with `Error: Playwright Test did not expect test() to be called here`. The file
pins `include: ["test/**/*.test.ts"]`, which is where the frozen contract puts the self-tests. It also
sets `fileParallelism: false`, because Vitest runs test *files* in parallel and the gate's self-tests
each start an app and run a real Playwright process — two Playwright runs at once is not allowed. No
given configuration file was changed; `package.json`'s `"test": "vitest run"` is untouched.

### D6 — `tests/controls.ts` added

**Not in the frozen Deliverables table**, which lists `tests/controls.json` but nothing that reads it.

**Reason.** The given `tsconfig.json` does not set `resolveJsonModule`, so importing the JSON directly
does not typecheck, and `tsconfig.json` was not ours to change. This module reads it with `node:fs` and
exposes `stableReadN(control)`. It sits under `tests/`, so lint and typecheck do cover it, and it is not
a `*.spec.ts`, so neither Playwright's `testMatch` nor the coverage report's title scan sees it as a
test.

### D7 — exit 3 also covers an unexpected internal error, not only a bad input

**Frozen text:** "An input error (a missing or malformed `known-reds.yml`, a report that cannot be read,
the app not answering) is 3."

**As built:** every throw that reaches the top level exits 3. An input error prints
`gate: input error: <what>`; anything else prints `gate: failed: <message>` **and a stack trace**.

**Reason.** The alternative is an unhandled rejection, whose exit code Node chooses and which reads as a
crash. Exiting 3 keeps the rule "1 and 2 are verdicts about the product, 3 means the gate could not
judge" true in both cases. A reader must not take every 3 as "your input was bad", which is why the two
are worded differently and only the internal case prints a stack.

### D8 — a unit that ran no test is an input error

**Not in the frozen text at all.**

**As built:** if a unit's report contains zero outcomes, the gate exits 3 with
`the unit <file> ran no test at all (playwright exited <n>): ...`.

**Reason.** Playwright writes a report with `suites: []` and exits 1 when it finds no test in the file
it was handed. The first implementation read that as a clean unit and reported `0 passed, 0 failed` and
`exit 0` — a gate reporting green for a unit that never ran, which is the worst thing a gate can do. The
spec file was named, so it has to contain a test.

### D9 — `POST /api/tasks` defaults and response

**Frozen text:** "create; a missing or empty `title` is 400 `{"error":"title is required"}`" — and
nothing about the rest.

**As built:** 201 with the created task object. `status` defaults to `open` (only the literal `"done"`
selects `done`), `due` is taken when it is a non-empty string and is `null` otherwise, and a `title` of
only whitespace counts as empty.

**Reason.** The route table fixed the error case and left the success case open. `open` is the only
defensible default for a newly created task on a board whose other filter value is `done`.

### D10 — `pnpm lint` and `pnpm typecheck` do not cover `test/**` or `vitest.config.ts`

*Resolved after the run: see "Changes after the run", item 1.*

**As built, and not fixed.** The given `tsconfig.json` includes `["apps", "tools", "tests",
"playwright.config.ts"]` and the given `biome.json` the same set — `tests`, not `test`, while the frozen
contract puts the self-tests in `test/`. Measured: all three `test/*.test.ts` files and
`vitest.config.ts` are absent from `tsc --noEmit --listFiles`, and `biome check` on each prints
`Checked 0 file`.

**Reason it stands.** Fixing it means editing a given file, which was out of bounds. Nothing there is
unverified — `pnpm test` runs all 34 cases — but a type error surfaces at run time rather than at
`pnpm typecheck`, and `test/gate.test.ts` is the only automated check that the gate's four classes and
four exit codes are right. Recorded as incidental finding 1 in PROGRESS.md and as 要判断 1 in
[PUBLISHING.md](../PUBLISHING.md), with the exact one-line fix, for someone with the authority to make
it.

### D11 — error bodies and statuses the route table left open

| Case | As built |
|---|---|
| `PATCH /api/tasks/:id` with any other `status` | 400 `{"error":"status must be open or done"}` |
| `PATCH /api/tasks/:id` on an unknown id | 404 `{"error":"not found"}` |
| a body that is not valid JSON, on any write route | 400 `{"error":"invalid JSON body"}` |
| `POST /__admin/deploy` without a semver `version` | 400 `{"error":"version must be a semver"}` |
| any unknown path under `/api/` or `/__admin/` | 404 `{"error":"not found"}` |

**Reason.** The frozen text gave the status for the invalid-`status` case ("anything else is 400") but
no body, and said nothing about the others. Each mirrors the shape the contract does fix elsewhere —
`{"error": "<what>"}` — and JSON paths answer with JSON while page paths answer with a page.

### D12 — an unrecognised `status` or `sort` value is not a filter and not a sort

**As built:** only `status=open`, `status=done` and `sort=due` have an effect; any other value leaves
the collection unfiltered and unsorted.

**Reason.** The frozen text defines those three values and is silent on the rest, and no case in the
sheet covers one. Inventing a fourth behaviour — a 400, say — would have created an untested branch and
an expectation taken from nothing.

### D13 — the JSON collection shape

**As built:** `GET /api/tasks` returns a bare JSON array; `GET /api/tasks/:id` returns the task object;
a task is `{id, title, status, due}` with `due` `null` when absent.

**Reason.** "the tasks as JSON" and "one task" read most naturally as the list and the object, with no
envelope.

### D14 — `catalog/cases.csv` uses LF, not CRLF

**Frozen text:** "RFC 4180, with a header row".

**As built:** RFC 4180's quoting rules exactly — a field holding a comma or a quote is quoted and an
inner quote is doubled — but LF line endings. `grep -c $'\r'` is `0`.

**Reason.** The given `.gitattributes` is `* text=auto eol=lf`, so CRLF in the working tree would fight
a file that was not ours to change. The quoting rules are what a parser has to honour, and they are
unchanged; TB-001's `expected` cell exercises both, so a `split(',')` reader would mis-read the sheet.

### D15 — how the `domain` column is split

**Frozen text:** "`domain` is one of `home`, `tasks`, `notifications`, `api`" — without saying how to
divide them.

**As built:** HTML pages by feature (`home`, `tasks`, `notifications`) and every JSON endpoint under
`api`, including `POST /api/notifications/test` (TB-021) and `GET /version` (TB-022).

**Reason.** A split by surface is the only one that makes all four names mean something consistent; a
split purely by feature would leave `api` with no clear membership.

### D16 — the coverage report prints `-` for a zero denominator

**As built:** when `cases − n/a` is 0 there is nothing to be a share of, so the cell is `-` rather than
a division by zero. Not reached by the real sheet; pinned by a self-test.

### D17 — CI triggers on `workflow_dispatch` only

**Frozen text** described the steps, not when they run.

**As built:** `workflow_dispatch` alone, with the reason in a comment in the workflow.

**Reason.** `materials/practice.md` §8: 「CI のワークフローは回帰ゲートとして手動で起動していました。
マージのたびに走るゲートにはしていません」.

### D18 — the app's test hooks, and how an absent due date renders

**Frozen text** named only `data-testid="today-counter"`.

**As built** the app also exposes `task-list`, `task-row`, `task-title`, `task-status`, `task-due`,
`send-test-email` and `test-email-result`, and a task with no due date renders the text `no due date`.

**Reason.** The UI cases need stable hooks, and a blank cell for a missing due date would be
indistinguishable from a rendering fault. The wording is the app's own; the sheet's expectations stay at
the contract's level of detail and say "shown as having none".

### D19 — the suite's collection assertions are relational, not absolute

**As built:** no UI or API test asserts "exactly five tasks". They assert that the five seeded tasks are
present, that every listed task has the filtered status, and that every undated task comes after every
dated one.

**Reason.** The contract has no delete route, so the tasks created by TB-017, TB-019 and TB-020 live as
long as the app process. An absolute count would go red on the second of two consecutive `pnpm e2e`
runs and under the gate, which runs every unit against one long-lived app — for a reason that has
nothing to do with the product. The relational form is also closer to what the contract actually states.

## Changes after the run

Made by a human on 2026-09-30, after the bus had answered DONE; not reviewed by the bus. Each was
verified from a fresh working tree on the run's Ubuntu 20.04 host and on Windows 11 (Node v24.15.0):
`pnpm i && pnpm exec playwright install chromium && pnpm test && pnpm gate` exits 0 on both, with
`Tests  34 passed (34)` and `0 NEW RED, 0 INCONCLUSIVE, 1 KNOWN RED, 0 WENT GREEN`.

1. **D10 resolved.** `tsconfig.json` now includes `test` and `vitest.config.ts`, and `biome.json` the
   same. `pnpm lint` reads `Checked 26 files`; `pnpm typecheck` is clean; the four newly checked files
   needed no change. Incidental finding 1 of PROGRESS.md and 要判断 1 of PUBLISHING.md are closed by it.
2. **The gate on Windows.** On Windows `pnpm gate` stopped with an input error before any unit ran.
   Three causes, each measured, each fixed in `tools/gate.ts` without changing what the gate decides:
   - The unit command spawned `node_modules/.bin/playwright`, a shell script that Windows cannot spawn
     without a shell (`spawnSync` answered `ENOENT`). It now runs Playwright's CLI script with the
     current `node`, the way the app was already started. This changes D4's command to
     `node <@playwright/test/cli> test <file> --reporter=json --retries=0 --workers=1`.
   - Playwright reads a file argument as a regular expression, so a Windows path with `\` matched no
     test (`Error: No tests found`). Spec paths now use `/` on every platform, which also keeps the
     unit order and the printed names identical everywhere.
   - `/version` was read with `fetch`, which reuses a pooled keep-alive socket. The unit runs through
     `spawnSync`, which blocks the gate's event loop, so a socket the app closed during a unit longer
     than its keep-alive timeout (5 s) still looked reusable. On Windows the next read failed with
     `ECONNRESET`: reproduced with a 6-second block, and not with a 3-second one; the same probe
     passed on the Ubuntu host. `/version` is now read on a fresh connection each time.
3. **Host details redacted.** The absolute paths of the run's host in PROGRESS.md and BUS-MEMORY.md,
   which contained the account name, now read `~/…`. The session id in BUS-LOG.md is kept; it
   identifies nothing outside this run. This closes 要判断 2 of PUBLISHING.md.

## The sample app, as built

`pnpm app` starts it on `PORT` (default 18430). Five tasks are seeded in memory at start, two without a
due date and four `open`. `version` starts at `1.4.0` and `build` is 12 hex characters drawn once per
process.

| Route | Behaviour |
|---|---|
| `GET /` | the home page: title "Acme Tasks" and the **today counter** (`data-testid="today-counter"`), which counts up from 0 to the number of open tasks over about 600 ms, showing the numbers in between — the unstable control on purpose |
| `GET /tasks` | the task list; `?status=open` and `?status=done` filter; `?sort=due` sorts by due date with tasks that have no due date **last** (D12, D18) |
| `GET /tasks/:id` | a task's detail page; an unknown id is a 404 **page** (`content-type: text/html`) |
| `GET /settings/notifications` | a "Send a test email" button that calls `POST /api/notifications/test` and shows the result |
| `GET /api/tasks` | the tasks as a JSON array; the same `status` and `sort` parameters (D13) |
| `GET /api/tasks/:id` | one task, or 404 **JSON** `{"error":"not found"}` |
| `POST /api/tasks` | create; 201 with the task; a missing, empty or whitespace-only `title` is 400 `{"error":"title is required"}` (D9) |
| `PATCH /api/tasks/:id` | change `status` to `open` or `done`; anything else is 400 `{"error":"status must be open or done"}`; an unknown id is 404 (D11) |
| `POST /api/notifications/test` | there is no mail transport in this demo: always 503 `{"error":"mail transport unavailable"}` |
| `GET /version` | `{"version":"<semver>","build":"<12 hex characters>"}`, starting at `1.4.0` |
| `POST /__admin/deploy` | body `{"version":"<semver>"}`: from now on `/version` reports that version and a new build id — a simulated redeployment. A non-semver body is 400 (D11) |

## The manual test sheet — `catalog/cases.csv`

RFC 4180 quoting with LF line endings (D14), header `id,domain,priority,title,steps,expected,automation`.
23 cases: `{home: 3, tasks: 6, notifications: 2, api: 12}` by domain (D15), `{P0: 14, P1: 9}` by
priority, `{ui: 10, api: 11, manual: 1, n/a: 1}` by automation. All eleven routes above have at least
one case. TB-011 is the test email case (`ui`); TB-003 is the one `manual` case with its reason in
`steps`; TB-023 is the one `n/a` case, `POST /__admin/deploy`, with its reason — it is out of the
coverage denominator and is exercised instead by the gate's INCONCLUSIVE fixtures.

## The suite, as built

- Every test title starts with a case id and a space. 21 tests across 6 files; 21 `ui`/`api` cases in
  the sheet; no gap and no orphan.
- `playwright.config.ts`: `testDir` from `GATE_SPECS` or `tests` (D3), `testIgnore` the fixtures unless
  `GATE_SPECS` is set, `retries: 0`, `workers: 1`, reporters `list` and `json` (to `reports/e2e.json`),
  `webServer` running `pnpm app` with `reuseExistingServer: true`, `use.baseURL` from the port.
- The today counter is read only through the stable read.
- TB-011 expects the email to be sent — the product's specified behaviour. It is red here because there
  is no mail transport, and it is declared in `known-reds.yml`. `pnpm e2e` therefore exits 1 (D1).
- API tests: `tests/api/tasks.spec.ts`, `tests/api/notifications.spec.ts`, `tests/api/version.spec.ts`,
  one per endpoint group, all using the `request` fixture and no `page`.

## tools/, as built

**stable-read** — `readStable(read, { n, intervalMs = 100, timeoutMs = 5000 })`: calls `read()` until it
returns the same value `n` times in a row and returns it; on timeout throws `StableReadTimeoutError`
listing every value it saw. `n` comes from `tests/controls.json` (the today counter: 3). Rejects `n < 1`.

**coverage-report** (`pnpm coverage`) — reads the sheet and the test titles of `tests/ui` and
`tests/api` (never the fixtures) and prints, per domain × priority: cases, automated (D2), manual, n/a,
and coverage = automated ÷ (cases − n/a) to one decimal, `-` when that denominator is 0 (D16); then the
overall line. Lists every `ui`/`api` case with no test ("gap") and every test id not in the sheet
("orphan"). Exit 0 with neither, 1 otherwise. Paths resolve against the working directory, so a
self-test can run the same tool against a planted repository.

**gate** (`pnpm gate`) — starts the app itself on `PORT` (default 18430), once, as
`node apps/sample-app/server.ts` rather than through `pnpm app` so the pid it holds is the server's, and
keeps it up for the whole run. Runs every spec file under `tests/ui` and `tests/api` as one **unit**, one
at a time, in file-name order: `GET /version` → `playwright test <file> --reporter=json --retries=0
--workers=1` (D4) → `GET /version`. Every failed test is classified by its case id:

| Class | Condition | Counts as failure | Advice it prints |
|---|---|---|---|
| KNOWN RED | the id is declared in `known-reds.yml` | no | the declaration's reason and source |
| INCONCLUSIVE | not declared, and the unit's version or build changed during the unit | yes | rerun this unit on one build, with the before and after versions |
| NEW RED | not declared, and neither version nor build changed | yes | treat as a regression until reproduced otherwise on the same build |

Declaration is checked first, so a declared id in a unit whose build moved is KNOWN RED, not
INCONCLUSIVE. Every **declared** id that passed is **WENT GREEN**: reported only, with "verify on one
build, then remove the declaration by hand; the gate never rewrites known-reds.yml", plus "across a
redeployment: not evidence of a fix" when that unit's version moved.

- `known-reds.yml`: a list of entries with `id`, `reason`, `source` and `declared`. A missing or
  empty one of those is an input error naming the entry. Only a red that does not mean a product defect
  may be declared.
- Exit codes: 1 if any NEW RED; else 2 if any INCONCLUSIVE; else 0. An input error is 3 — a missing,
  malformed or non-list `known-reds.yml`, an entry missing a required key, a report that cannot be read,
  a unit that ran no test (D8), or the app not answering. An unexpected internal error is also 3 (D7).
- Prints one table per class present and writes the same result to `reports/gate.json`. Whichever gate
  run finishes last owns that file, so `pnpm test` overwrites the real suite's result.
- `GATE_SPECS` replaces `tests/ui` and `tests/api`, `KNOWN_REDS` replaces `known-reds.yml`, and `PORT`
  is passed on to Playwright.

**Self-tests** (`pnpm test`) — 34 cases in 3 files: 8 for the stable read, 14 for the report on planted
inputs (including that a planted gap lowers both the affected bucket's and the overall percentage), and
12 for the gate on the fixtures — each of the four classes produced for real, each exit code 0/1/2/3
produced, and an INCONCLUSIVE produced by a fixture test that calls `POST /__admin/deploy` in the middle
of its unit. No report is ever hand-written.

## README.md, as built

English summary, then 何を示すか / 背景 / 設計 / 動かし方 / 結果 / 制約・既知の限界 / 作り方, then
`設計・レビュー・検証：So Ryo ／ 実装：AI エージェント（Claude Code）との協働`.
「設計」 gives the reason for each of the six rules with Acme Tasks as the example. 「動かし方」 carries the
chain of D1 and explains `pnpm e2e`'s exit 1. 「結果」 quotes this repository's own runs and links the case
study for the work figures. 「制約」 covers the 1.62.1 pin, Chromium only, `pnpm e2e`'s exit code, that
`reports/gate.json` belongs to the last gate run, and D10. 「作り方」 links `goal-pack/`.

## CI — `.github/workflows/ci.yml`, as built

`ubuntu-24.04`, Node 24, `workflow_dispatch` only (D17): checkout, `corepack enable`,
`actions/setup-node`, `pnpm install --frozen-lockfile`,
`pnpm exec playwright install --with-deps chromium`, lint, typecheck, test, e2e
(`continue-on-error: true`, D1), gate, coverage, and `reports/` uploaded with `if: always()`.
Two of those were not verified on this host: `--with-deps` needs root and was never run, and
`corepack enable` was run, broke this host's pnpm and was restored — both are recorded in PROGRESS.md
(AC-13, change-ledger row 13) and `corepack enable` is marked CI-only in the workflow.

## Rules for the content

- Japanese for README.md and PUBLISHING.md (です・ます調); English for code, comments and test titles
  after the case id.
- No figures about the author's work; no employer, product, customer, team or person names.

## Out of scope

Authentication, persistence, a real mail transport, Docker, other browsers than Chromium, and any delete
route (which is why D19 exists).
