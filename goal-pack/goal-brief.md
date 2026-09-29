# Goal brief — regression-gate-demo

> This file is the worker's only entry point. Read all of it before you start.
> Contract: [SCOPE.md](SCOPE.md). Ledger: [PROGRESS.md](PROGRESS.md). Human manual: [runbook.md](runbook.md).
> Source material: [materials/practice.md](materials/practice.md).

## Mission

Build a small, honest demonstration of a regression practice: a sample app, a Playwright suite tied to
a manual test sheet by case id, a coverage report whose denominator is that sheet, and a quality gate
that tells a new red from a declared one, from a red that crossed a redeployment, and from a declared
red that went green. A reader should see why each rule exists, not only that it does.

| Goal | Scope | In one line |
|---|---|---|
| G0 | skeleton | toolchain, Chromium, a first app and a first test, freeze the contract |
| G1 | app and suite | the sample app, the sheet, UI and API tests, the stable read |
| G2 | tools | the coverage report and the gate, with real negative self-tests |
| G3 | finish | README with the reasons, CI, PUBLISHING.md, the contract → AS-BUILT |

Every row is already listed in PROGRESS.md. Do not add or remove rows; to change a plan, write the
reason in PROGRESS.md first.

## Required reading

| Resource | Why |
|---|---|
| [SCOPE.md](SCOPE.md) | the only authority for the app, the sheet, the tools, the classes and the exit codes |
| [materials/practice.md](materials/practice.md) | the rules and their reasons, and everything you may say about the author's practice |
| [PROGRESS.md](PROGRESS.md) | the rows you judge |

## Facts already verified (2026-09-30, on this Linux host) — use them, do not re-investigate

Measured on the host that runs this pack, with a scratch copy of this repository's configuration:

- Linux (Ubuntu 20.04), Node `v24.19.0`. In the repository root `pnpm --version` prints `11.28.0`:
  corepack follows `packageManager`.
- `pnpm install` finished in about 2 seconds (`Done in 1.8s using pnpm v11.28.0`) with
  `@playwright/test 1.62.1`, `typescript 7.0.2`, `vitest 5.0.2`, `yaml 2.9.1`, `@biomejs/biome 2.5.14`.
  No dependency needs a build script; leave `pnpm-workspace.yaml` as it is.
- **Why Playwright is pinned at 1.62.1:** with 1.63.0, `playwright install chromium` fails on this
  host with `ERROR: Playwright does not support chromium on ubuntu20.04-x64`. With 1.62.1 it installed
  `chromium-1234` and its headless shell, and a headless page opened in about 2 seconds
  (`Chrome Headless Shell 151.0.7922.34`). Do not upgrade it.
- The browsers live in the directory that `PLAYWRIGHT_BROWSERS_PATH` names (set in your environment
  and already populated). Never install browsers anywhere else, and never pass `--with-deps`: it needs
  root, and the system libraries are already present.
- The HTTPS proxy comes from environment variables: **never unset or print them.**
- Ports 18430–18439 are free on this host. Use only these: the app defaults to 18430, and the
  self-tests use 18431–18439. Other services listen on this machine; do not touch them.
- Node runs `.ts` files directly (`node apps/sample-app/server.ts`); there is no build step.
  `tsconfig.json` sets `allowImportingTsExtensions` and `verbatimModuleSyntax`, so write local imports
  with the `.ts` suffix and use `import type` for types. Biome's lint preset is `recommended` over
  `apps/**`, `tools/**`, `tests/**` and `playwright.config.ts`.
- No Docker is needed; do not start containers.

## Deviations from the project rules

None.

## How to build this repository

- **The contract decides expectations, never the code.** A test expects what SCOPE.md says. If the app
  disagrees, the app is wrong — unless it is the declared test email case.
- **Evidence is a run.** Quote command output, including exit codes. For the gate, quote its tables.
- **Negative self-tests are real runs.** Produce each class and each exit code by running the real gate
  on fixtures; the INCONCLUSIVE case changes the version in the middle of its unit for real.
- **Reasons, not only rules.** The README's 「設計」 explains each rule from the materials, in your own
  words, with the sample app as the example. No figures about the author's work.
- **Stability.** `retries: 0` everywhere. Where a value settles over time, use the stable read; never
  add a sleep to make a test pass.

## Definition of done for each goal

1. **Read first.** Read the current state before changing a file.
2. **It runs.** `pnpm test`, `pnpm e2e` (from G1), `pnpm gate` (from G2), `pnpm lint` and
   `pnpm typecheck` pass as the rows require; paste the output.
3. **Every row has a verdict** from the table below; nothing is left unexplained.
4. **PROGRESS.md first, report second.**
5. **Leave nothing behind.** Temporary files go to the OS temp directory (`mktemp -d`) and are removed;
   stop every process you started; record anything you create outside the deliverables in the change
   ledger.

### Verdicts

| Verdict | Meaning | Required |
|---|---|---|
| PASS | you observed what the row describes | quote the observation (command output with the exit code, or the lines of the file with their numbers) |
| FAIL | the observation contradicts the row | `expected "<X>" / actual "<Y>"`; if you cannot write that, it is not a FAIL |
| BLOCKED | you could not verify it | say what is missing |
| DEFERRED | it depends on an open decision | name the decision |

"Works as expected", "no issues" and "looks fine" count as unverified. When in doubt, BLOCKED — never
round an uncertainty up to PASS.

### The evidence gate is mechanical

`.claude/hooks/evidence-gate.sh` runs at the end of every turn while `goal-pack/.gate-armed` exists.
It blocks the turn when a PASS has empty evidence, a weasel phrase or no quotation mark; when a FAIL is
not "expected / actual"; when a BLOCKED or DEFERRED gives no reason; or when a verdict word is unknown.

It reads the file, not the conversation. So:
- **Never invent a quotation to pass it.** Quote only what you observed in this session. If you cannot,
  BLOCKED with the reason is the honest verdict and does not count against you.
- After 5 blocks in a row it lets the turn end to avoid a loop. Say so plainly in your report.

### Run things one at a time

Never run two Playwright runs at once, and never run the gate while `pnpm e2e` is running. Wait for a
long command with one blocking call; do not start it in the background.

## Red lines — stop and report if you are about to cross one

1. Do not create, switch or modify branches.
2. Do not commit or push; the human commits between goals.
3. **Read and write only inside this repository, the OS temp directory and the browser directory.**
   Do not open, list or search anything else on this machine — not the home directory, not other
   repositories.
4. No credentials in any document. Do not unset or print the proxy environment variables.
5. Do not fix unrelated problems; record them under "Incidental findings". A defect **your own change**
   introduced is not unrelated: fix it in the same goal.
6. Do not edit the given files listed in SCOPE.md (configuration, LICENSE, `goal-pack/materials/`).
7. Network: only `pnpm install` and `pnpm exec playwright install chromium`. No `sudo`, no Docker.
8. No employer, product, customer, team or person names; no figures about the author's work.

### There is a bus above you

While `goal-pack/.bus-armed` exists, every turn you end meets the goal-bus Stop hook:
- **Inside a goal** it sends you back ("Continue Gn: N row(s)…"), so you do not need `/goal`. The hook
  reads PROGRESS.md, not the conversation: a table where every row has a verdict is the only way out.
- **When you print `PROGRESS: <goal> COMPLETE`** it checks the table and the evidence, then wakes the
  bus. The bus answers PASS (the next goal's instructions) or REJECT (what to fix).
- **The bus sees every earlier goal** and re-runs checks itself. An invented quotation will not survive
  it; BLOCKED will.

## Turn rhythm and progress protocol

- Each turn closes at least one row end to end, including writing it to PROGRESS.md.
- End the turn with: `PROGRESS: <goal> ac_done=X/Y pass=a fail=c blocked=d deferred=e`
- When every row of the goal has a verdict and PROGRESS.md is written: `PROGRESS: <goal> COMPLETE`
- When you are blocked: `PROGRESS: <goal> BLOCKED <reason>` — goal name first.
- The numbers must match PROGRESS.md.

**A turn must end on one of these lines. This is not formatting; it is what keeps the chain alive.**
The hooks run only when a turn ends, and they recognise you and your boundary by this line. End on
anything else and nobody is woken: your process ends and the chain stops silently. It follows that
starting a long task in the background and ending the turn throws its result away, and that a long task
is awaited with **one blocking call**, anchored on its output.

## After context compaction

1. Read PROGRESS.md and take the next empty verdict of the current goal.
2. If this brief is no longer in your context, read it again, completely, then SCOPE.md.
3. Check that SCOPE.md still says FROZEN (or AS-BUILT after G3).
4. Run `pnpm test` once to confirm the workspace is healthy, and make sure no app of yours is still
   listening before you start one.
