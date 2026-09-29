# regression-gate-demo — scope and contract

**Contract status: DRAFT.** Frozen in G0 (content unchanged, date added); rewritten as AS-BUILT in G3.

A small sample web app, a Playwright regression suite whose test titles carry the ids of a manual test
sheet, a coverage report whose denominator is that sheet, and a quality gate that tells four kinds of
red apart. The rules come from the author's practice, summarised in
[materials/practice.md](materials/practice.md). The sample app is **Acme Tasks**, a fictional task
board.

## Deliverables

| Path | Content |
|---|---|
| `apps/sample-app/server.ts` | the sample app: `node:http` only, no framework, in-memory data |
| `catalog/cases.csv` | the manual test sheet, the denominator of the coverage report |
| `tests/ui/*.spec.ts` | UI tests; every title starts with its case id |
| `tests/api/*.spec.ts` | API tests with Playwright's `request`, one file per endpoint group |
| `tests/fixtures/` | specs used only by the gate's self-tests (ignored by `pnpm e2e`) |
| `tests/controls.json` | N per control for the stable read |
| `tools/stable-read.ts` | the stable read |
| `tools/coverage-report.ts` | the coverage report |
| `tools/gate.ts` | the quality gate |
| `known-reds.yml` | the declared reds |
| `test/*.test.ts` | Vitest tests for the three tools, including the gate's negative self-tests |
| `playwright.config.ts` | the Playwright configuration below |
| `README.md`, `PUBLISHING.md`, `.github/workflows/ci.yml` | as described below |

Given and not to be changed: `LICENSE`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`,
`biome.json`, `.gitignore`, `.gitattributes` and everything under `goal-pack/materials/`. If one of the
configuration files really has to change, record the reason under "Contract changes" in PROGRESS.md
first. In particular `@playwright/test` stays at 1.62.1 (see the brief).

## The sample app

`pnpm app` starts it on `PORT` (default 18430). Data is seeded in memory at start: five tasks, two of
them without a due date.

| Route | Behaviour |
|---|---|
| `GET /` | the home page: title "Acme Tasks" and the **today counter** (`data-testid="today-counter"`), which counts up from 0 to the number of open tasks over about 600 ms, showing the numbers in between — the unstable control on purpose |
| `GET /tasks` | the task list; `?status=open\|done` filters; `?sort=due` sorts by due date with tasks that have no due date **last** |
| `GET /tasks/:id` | a task's detail page; an unknown id is a 404 page |
| `GET /settings/notifications` | a "Send a test email" button that calls `POST /api/notifications/test` and shows the result |
| `GET /api/tasks` | the tasks as JSON; the same `status` and `sort` parameters |
| `GET /api/tasks/:id` | one task, or 404 `{"error":"not found"}` |
| `POST /api/tasks` | create; a missing or empty `title` is 400 `{"error":"title is required"}` |
| `PATCH /api/tasks/:id` | change `status` to `open` or `done`; anything else is 400 |
| `POST /api/notifications/test` | there is no mail transport in this demo: always 503 `{"error":"mail transport unavailable"}` |
| `GET /version` | `{"version":"<semver>","build":"<12 hex characters>"}`, starting at `1.4.0` |
| `POST /__admin/deploy` | body `{"version":"<semver>"}`: from now on `/version` reports that version and a new build id — a simulated redeployment |

## The manual test sheet — `catalog/cases.csv`

RFC 4180, with a header row: `id,domain,priority,title,steps,expected,automation`.
- `id` is `TB-` and three digits; `domain` is one of `home`, `tasks`, `notifications`, `api`;
  `priority` is `P0` or `P1`; `automation` is `ui`, `api`, `manual` or `n/a`.
- At least 16 cases, covering every route above, including the test email case (automation `ui`), at
  least one `manual` case with its reason in `steps`, and at least one `n/a` case with its reason.
- Expectations come from this contract, never from the code.

## The suite

- Every test title starts with a case id followed by a space: `TB-003 filters open tasks`.
- `playwright.config.ts`: `testDir` `tests`, `testIgnore` the fixtures, `retries: 0`, `workers: 1`,
  reporters `list` and `json` (to `reports/e2e.json`), `webServer` running `pnpm app` with
  `reuseExistingServer: true`, `use.baseURL` from the port.
- The today counter is read only through the stable read.
- The test email case expects the email to be sent (the product's specified behaviour). In this demo it
  is red because there is no mail transport: it is declared in `known-reds.yml`.

## tools/

**stable-read** — `readStable(read, { n, intervalMs = 100, timeoutMs = 5000 })`: calls `read()` until it
returns the same value `n` times in a row and returns that value; on timeout it throws an error that
lists the values it saw. `n` for each control comes from `tests/controls.json` (the today counter: 3).

**coverage-report** (`pnpm coverage`) — reads the sheet and the test titles of `tests/ui` and
`tests/api` (not the fixtures) and prints, per domain × priority: cases, automated, manual, n/a, and
coverage = automated ÷ (cases − n/a) as a percentage with one decimal; then the overall line. It lists
every `ui` or `api` case with no test ("gap") and every test id that is not in the sheet ("orphan").
Exit 0 with neither, exit 1 otherwise.

**gate** (`pnpm gate`) — starts the app itself on `PORT` (default 18430) and runs every spec file
under `tests/ui` and `tests/api` as one **unit**, one at a time, in file-name order:
`GET /version` → `playwright test <file> --reporter=json --retries=0 --workers=1` → `GET /version`.
Every failed test is classified by its case id:

| Class | Condition | Counts as failure | Advice it prints |
|---|---|---|---|
| KNOWN RED | the id is declared in `known-reds.yml` | no | the declaration's reason and source |
| INCONCLUSIVE | not declared, and the unit's version or build changed during the unit | yes | rerun this unit on one build (with the before and after versions) |
| NEW RED | not declared, and the version did not change | yes | treat as a regression until reproduced otherwise on the same build |

and every **declared** id that passed is **WENT GREEN**: reported only, with "verify on one build, then
remove the declaration by hand; the gate never rewrites known-reds.yml"; when its unit's version
changed, it adds "across a redeployment: not evidence of a fix".

- `known-reds.yml`: a list of entries with `id`, `reason`, `source` and `declared` (a date). An entry
  without any of them is an input error. Only a red that does not mean a product defect may be
  declared; `reason` says why.
- Exit codes: 1 if any NEW RED; else 2 if any INCONCLUSIVE; else 0. An input error (a missing or
  malformed `known-reds.yml`, a report that cannot be read, the app not answering) is 3.
- It prints one table per class present and writes the same result to `reports/gate.json`.
- `GATE_SPECS` (a directory) replaces `tests/ui` and `tests/api`, and `KNOWN_REDS` (a file) replaces
  `known-reds.yml`, so the self-tests can run the real gate on the fixtures. `PORT` is passed on to
  Playwright, and `playwright.config.ts` takes the port from it, so a gate on another port reuses its
  own app.

**Self-tests** (`pnpm test`) cover the stable read and the report with planted inputs, and the gate
with the fixtures: each of the four classes produced for real, each exit code 0 / 1 / 2 / 3 produced,
and an INCONCLUSIVE produced by a fixture test that calls `POST /__admin/deploy` in the middle of its
unit — a real mid-run change, not a forged report.

## README.md — sections

The English summary, then 何を示すか / 背景 / 設計 / 動かし方 / 結果 / 制約・既知の限界 / 作り方, then
the signature line `設計・レビュー・検証：So Ryo ／ 実装：AI エージェント（Claude Code）との協働`.
- 「設計」 explains **the reason behind each rule**: why the denominator is the sheet; why a red across a
  redeployment is not a regression; why going green does not re-baseline by itself; why a check that
  mirrors a product rule is not relaxed; why retries are 0; why the counter waits for stable reads.
- 「動かし方」: `pnpm i && pnpm exec playwright install chromium && pnpm test && pnpm e2e && pnpm gate`.
- 「結果」 quotes this repository's own runs (the gate's table, the coverage table, the test counts) and
  points to the case study for the work figures:
  https://github.com/MuneAkira6/engineering-case-studies/blob/main/02-test-automation-and-quality-gates.md
- 「制約」 says why Playwright is pinned at 1.62.1.
- 「作り方」 says the repository was built by an unattended goal-bus run and links `goal-pack/`.

## CI — `.github/workflows/ci.yml`

On ubuntu-24.04 with Node 24: install, `pnpm exec playwright install --with-deps chromium`, lint,
typecheck, test, e2e, gate and coverage; upload `reports/` as an artifact.

## Rules for the content

- Japanese for README.md (です・ます調); English for code, comments and test titles after the case id.
- No figures about the author's work; no employer, product, customer, team or person names.

## Out of scope

Authentication, persistence, a real mail transport, Docker, other browsers than Chromium.
