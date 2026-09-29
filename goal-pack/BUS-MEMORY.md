# Bus memory — regression-gate-demo

**This is a complement, not a summary.** Anything in PROGRESS.md, BUS-LOG.md or the goal brief does not
belong here. When a later measurement corrects an entry, come back and rewrite it. Marks: 🆕 new ·
✅ verified · 🔴 warning · ~~struck~~ no longer true.

## Environment facts across goals

- 🆕 Measured on this host while the pack was written (2026-09-30): Node `v24.19.0`; pnpm `11.28.0`
  through corepack and `packageManager`; `pnpm install` about 2 seconds, no build scripts.
- 🆕 Playwright is pinned at 1.62.1 because 1.63.0 refuses this Ubuntu 20.04 host
  (`Playwright does not support chromium on ubuntu20.04-x64`). 1.62.1's Chromium (headless shell
  151.0.7922.34) is already installed in the directory `PLAYWRIGHT_BROWSERS_PATH` names.
- 🆕 Ports 18430–18439 were free; other services listen on this machine and must not be touched.
- 🆕 An HTTPS proxy is configured through environment variables. Nobody unsets or prints them.
- 🆕 The run uses its own Claude configuration directory, so no user-level skills, memory or MCP servers
  are loaded. That is intended.

## Doubts to re-check

## The worker's habits

## Proven along the way — later goals may cite

## What the bus verified itself

## Rulings the bus made

## Watch closely

- 🔴 Expectations from the contract, never from the code; a test adjusted to the app's behaviour is a
  test that measures nothing.
- 🔴 No sleeps, no retries: a flaky pass hides exactly what this repository is about.
- 🔴 The only declared red is the test email case, and it is declared because the environment has no
  mail transport, not because the product is broken. Any other declaration needs a ruling.
- 🔴 The negative self-tests must be real runs: forged JSON reports do not count, and the INCONCLUSIVE
  case must change the version in the middle of its unit.
- 🔴 Your own probes stay in the OS temp directory and on ports 18430–18439; stop what you start.
