You are the worker for regression-gate-demo. First read goal-pack/goal-brief.md completely, then
goal-pack/SCOPE.md, goal-pack/materials/practice.md and goal-pack/PROGRESS.md.

This goal is G0: the toolchain, a running skeleton and the contract freeze. Work inside this
repository, the OS temp directory and the browser directory only.

1. Record `node --version`, `pnpm --version` (in the repository root, so packageManager decides) and
   `pnpm exec playwright --version` in the Environment table of PROGRESS.md, with the output.
2. Run `pnpm install` without changing pnpm-workspace.yaml. Record the result and how long it took.
3. Run `pnpm exec playwright install chromium` (no `--with-deps`) and record that it completes against
   the directory in `PLAYWRIGHT_BROWSERS_PATH`; record that directory's listing in the Environment table.
4. Write a first `apps/sample-app/server.ts` that serves at least `GET /` and `GET /version` as the
   contract describes, start it with `pnpm app`, quote `curl -s localhost:18430/version`, and stop it.
5. Write `playwright.config.ts` to the contract and one first test in `tests/ui/` that opens the home
   page; run `pnpm e2e` and quote the summary. Stop anything left listening.
6. Run `pnpm lint` and `pnpm typecheck` and quote their last lines.
7. Mark SCOPE.md as FROZEN with today's date, changing nothing else in it.

Judge every G0 row in PROGRESS.md with the output you quote. End every turn on a progress line such as
`PROGRESS: G0 ac_done=2/7 pass=2 fail=0 blocked=0 deferred=0`, and when every G0 row has a verdict,
end with `PROGRESS: G0 COMPLETE`.
