# Runbook — regression-gate-demo

<!-- For the human operator. The worker never needs this file. This run goes to a Linux host with its
     own CLAUDE_CONFIG_DIR and GOALBUS_ENV_FILE, launched with setsid nohup (see goal-bus-kit's
     examples/toy-run/README.md). -->

## 0. Before arming

- [ ] You created the branch yourself (no mechanical guard exists for this) and `git status` is clean.
- [ ] Both selftests are green **on the machine that will run the hooks**:
      `bash .claude/hooks/goal-bus.sh --selftest && bash .claude/hooks/evidence-gate.sh --selftest`
- [ ] `.claude/settings.local.json` has the permissions and hooks from `settings.hooks.json`, and
      `bash .claude/hooks/goal-bus.sh --status` reports the hook timeout as ok.
- [ ] Nothing else uses the same environment: no other armed pack in any working tree or on any
      machine, and nobody testing by hand. Check again right before launch.
- [ ] Caps are calibrated: one run (4 goals, about 5 reviews, 35 rows) is below MAX_REVIEWS / MAX_TURNS.
- [ ] The usage budget for this run is available (check your plan's usage page).
- [ ] On a shared host: the run has its own `CLAUDE_CONFIG_DIR`, so the account's MCP servers, skills
      and memory stay out. If the CLI then authenticates with an environment token, set
      `GOALBUS_ENV_FILE` (see `bus.config.sh`) and prove it with one real call made from an
      environment that lacks the token.

## 1. Seed the bus

```bash
bash .claude/hooks/goal-bus.sh --seed      # starts a session that reads the pack, records its id
```

## 2. Arm and launch

```bash
touch goal-pack/.gate-armed goal-pack/.bus-armed
bash .claude/hooks/bin/start-worker.sh --file goal-pack/g0-instructions.md   # add --detach to background it
```

## 3. Watch

```bash
bash .claude/hooks/bin/watch.sh            # events only; it never reads transcripts for protocol text
bash .claude/hooks/goal-bus.sh --status    # where the run is, what was actually reviewed, cost
```

## 4. The goals

### G0 — toolchain, a running skeleton and the contract freeze
- Instructions for the worker: `goal-pack/g0-instructions.md`
- After the bus's PASS, check yourself: `pnpm app` answers `/version`; nothing was installed outside the
  browser directory. · Commit: `Add the sample app skeleton and the first Playwright test`

### G1 — the sample app, the sheet and the suite
- Step for the bus to adapt into instructions: every route of the contract, the sheet of at least 16
  cases, UI and API tests titled by case id, the stable read for the counter.
- Check yourself: two `pnpm e2e` runs agree per case; the only red is the test email case.
  · Commit: `Build the sample app, the manual test sheet and the suite`

### G2 — the coverage report and the gate (look at it in person)
- Step for the bus to adapt into instructions: the report and the gate to the contract; each class and
  each exit code produced by a real run on fixtures, INCONCLUSIVE by a real mid-run deploy.
- Check yourself: break a fixture and watch the class change; `pnpm gate` exits 0 with one KNOWN RED.
  · Commit: `Add the coverage report and the four-class gate with negative self-tests`

### G3 — README, CI and closing
- Step for the bus to adapt into instructions: README in the seven sections with the reason for each
  rule, CI, PUBLISHING.md, SCOPE.md → AS-BUILT.
- Check yourself: the leak scan (human only), then the README top to bottom.
  · Commit: `Add the README, CI and publishing notes`

## 5. When the relay stops

| Situation | What you see | What to do |
|---|---|---|
| Usage limit | BUS-LOG: "stopped by a usage or rate limit" | wait for the reset, then `start-worker.sh --resume <worker-id> "continue"`; never retry in a loop |
| ESCALATE | a systemMessage and a BUS-LOG entry | write the ruling into BUS-MEMORY.md, then `goal-bus.sh --notify "<ruling>"`, then resume the worker with `--next` |
| Planned pause | `.bus-paused` exists | when ready: `start-worker.sh --resume <worker-id> --file goal-pack/.bus-next` |
| Lost or unparsed verdict | BUS-LOG "UNPARSED" or a failed wake-up | `goal-bus.sh --recover`, then hand the NEXT block to the worker; do not pay for the review twice |
| Crash or stale lock | `--status` shows the lock held | make sure nothing is half-written, `goal-bus.sh --reset`, resume |
| Turn cap or reject cap | a systemMessage | read BUS-LOG; split the goal or change the approach rather than raising the cap |
| The worker ended silently | `watch.sh` prints `[ended]` or `[stall?]` | read the end of `goal-pack/.worker-log`; resume with a corrective instruction |

Never retype the command that wakes the bus: `--notify` is the one way to talk to it.

## 6. Rubber-stamp audit (the one hole no mechanism closes)

Read `BUS-REVIEWS.md` after the first PASS, after every high-risk goal and before the final commit.
Treat a verdict as suspect when two or more of these hold:

1. no first-person verification (I read, I ran, I queried);
2. every fact traces back to the worker's own report;
3. a PASS without any caveat, risk, debt or new question;
4. a REJECT without ordered steps, a completion criterion, a turn budget or a way out;
5. the same instructions as last time, nothing adapted to what was found;
6. the worker's counts or lists accepted without a recount;
7. BLOCKED versus DEFERRED never questioned;
8. no context figure or environment state, so the verdict cannot be tied to a moment.

## 7. After the run

- Commit at goal boundaries and check every commit message against the change it describes.
- Disarm: `rm goal-pack/.bus-armed goal-pack/.gate-armed`
- Keep BUS-LOG.md, BUS-REVIEWS.md, BUS-MEMORY.md, BUS-HANDOFF.md and PROGRESS.md in the repository;
  they are the evidence that makes the run auditable later.
