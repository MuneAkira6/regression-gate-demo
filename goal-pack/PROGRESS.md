# regression-gate-demo — progress ledger

<!-- Structure the hooks rely on: goals are h2 sections; machine-checked tables have a "Verdict" column
     and an "Evidence" column; the environment table uses "Proof" and the change ledger has no Verdict
     column, so the gate leaves them alone. An empty verdict means "not done yet". -->

**Status: not started.**

Verdicts: PASS / FAIL / BLOCKED / DEFERRED (defined in goal-brief.md). The "Plan" column is fixed before
the run; to change a plan, write the reason here first. "measure" means run it and quote the output,
including the exit code where the row is about one.

## Environment (filled in G0; every row with the command and its output)

| Item | Value | Proof |
| --- | --- | --- |
| Node | | |
| pnpm (selected by packageManager) | | |
| Playwright and its Chromium | | |
| Browser directory (PLAYWRIGHT_BROWSERS_PATH) | | |

## Environment change ledger (before → change → restored)

| # | Goal | Object | Before | Change | Restored |
| --- | --- | --- | --- | --- | --- |

## Contract changes (frozen in G0; any later rename or reshape goes here)

| Date | Entry | Content |
| --- | --- | --- |

---

## G0 — toolchain, a running skeleton and the contract freeze

| Condition | Verdict | Evidence |
| --- | --- | --- |
| E1 Node 24, the pnpm chosen by packageManager (11.28.0) and Playwright 1.62.1 recorded with the commands' output | | |
| E2 `pnpm install` succeeds with pnpm-workspace.yaml unchanged | | |
| E3 `pnpm exec playwright install chromium` completes against the browser directory (already populated) without installing system packages | | |
| E4 a first `apps/sample-app/server.ts` starts with `pnpm app` and `GET /version` returns the contracted JSON (quote the curl output) | | |
| E5 a first headless Playwright test opens the home page and passes (quote the list reporter's summary) | | |
| E6 `pnpm lint` and `pnpm typecheck` are clean | | |
| E7 SCOPE.md marked FROZEN with the date, its content otherwise unchanged | | |

## G1 — the sample app, the sheet and the suite

| AC | Item | Plan | Verdict | Evidence |
| --- | --- | --- | --- | --- |
| AC-1 | every route of the contract behaves as written, including the error bodies, `sort=due` with undated tasks last, and `POST /__admin/deploy` changing `/version` (quote curl output per route) | measure | | |
| AC-2 | the today counter shows values in between (quote a series of raw reads) and `readStable` with n=3 returns the final value (quote it) | measure | | |
| AC-3 | `catalog/cases.csv` meets the contract (count the cases per domain, priority and automation) and every `ui` or `api` case has a test whose title starts with its id | measure | | |
| AC-4 | `pnpm e2e` passes every test except the test email case, which is red for the contracted reason (quote the summary and that failure) | measure | | |
| AC-5 | the API tests are one file per endpoint group and use Playwright's `request` | measure | | |

### G1 checks

| Check | Verdict | Evidence |
| --- | --- | --- |
| `pnpm test` (the stable read's tests) passes | | |
| `pnpm lint` and `pnpm typecheck` are clean | | |
| `pnpm e2e` run twice in a row gives the same result per case (quote both summaries) | | |
| The change set is limited to the deliverables and this ledger (`git status --short`) | | |

## G2 — the coverage report and the gate

| AC | Item | Plan | Verdict | Evidence |
| --- | --- | --- | --- | --- |
| AC-6 | `pnpm coverage` prints the per domain × priority table and the overall line on the real sheet and suite, exit 0; its tests plant a gap and an orphan and see exit 1 | measure | | |
| AC-7 | the gate produces each of the four classes for real on fixtures, with the contracted advice lines (quote each) | measure | | |
| AC-8 | a fixture test that calls `POST /__admin/deploy` in the middle of its unit makes its red INCONCLUSIVE, with the before and after versions printed | measure | | |
| AC-9 | exit codes 0, 1, 2 and 3 each produced by a real gate run (quote the four runs) | measure | | |
| AC-10 | a `known-reds.yml` entry without `reason` or `source` is an input error (exit 3, the entry named) | measure | | |
| AC-11 | `pnpm gate` on the real suite exits 0 and lists the test email case as KNOWN RED with its reason; `reports/gate.json` holds the same result | measure | | |

### G2 checks

| Check | Verdict | Evidence |
| --- | --- | --- |
| `pnpm test` passes (quote the count) | | |
| `pnpm lint` and `pnpm typecheck` are clean | | |
| `pnpm gate` run twice in a row gives the same classes | | |
| The change set is limited to the deliverables and this ledger (`git status --short`) | | |

## G3 — README, CI and closing

| AC | Item | Plan | Verdict | Evidence |
| --- | --- | --- | --- | --- |
| AC-12 | README.md: the English summary, the seven sections in order, every rule of 「設計」 with its reason, the signature line; 「結果」 quotes this repository's own runs | read + quote | | |
| AC-13 | `.github/workflows/ci.yml` has the contracted steps; every one of their commands run here gives the result quoted (except `--with-deps`, which needs root: say so) | measure | | |
| AC-14 | PUBLISHING.md has a description, topics and the checklist before publishing; LICENSE is unchanged (`git diff --stat -- LICENSE` empty) | measure + read | | |
| AC-15 | the README's command line from a clean `node_modules` exits 0 (quote the last lines of each step) | measure | | |

### G3 closing

| Condition | Verdict | Evidence |
| --- | --- | --- |
| SCOPE.md rewritten as AS-BUILT, every difference from the frozen contract marked with a reason | | |
| Change list, and one proposed commit message per goal (G0–G3) | | |
| Nothing temporary left in the repository (`reports/` and `test-results/` are ignored by git) | | |
| No process of this run left listening on 18430–18439 (quote the check) | | |
| No unexplained empty verdict anywhere | | |

---

## Handover (filled at the end; each item = fact, impact, the decision needed)

## Incidental findings (recorded, not fixed)

| # | Finding | Where | Note |
| --- | --- | --- | --- |
