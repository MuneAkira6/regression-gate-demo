// The regression suite's configuration, as goal-pack/SCOPE.md, "The suite", spells it out.
//
// retries is 0 on purpose: a retry that turns a red green hides the red from whoever has to judge
// it. The port comes from PORT so the gate can run a unit against its own app on another port, and
// reuseExistingServer lets that app be the one already listening instead of a second one.

import { defineConfig } from "@playwright/test";

const port = Number(process.env.PORT ?? 18430);
const baseURL = `http://localhost:${port}`;

/**
 * GATE_SPECS replaces tests/ui and tests/api for the gate's self-tests (SCOPE.md, "tools/").
 *
 * The fixtures under tests/fixtures are specs whose whole job is to fail in a known way, so `pnpm e2e`
 * must never see them — hence the ignore. But naming a file on the command line does **not** override
 * testIgnore: with the ignore in place, `playwright test tests/fixtures/<x>.spec.ts` dies with
 * `Error: No tests found.` So when the gate points GATE_SPECS at a fixture directory, that directory
 * becomes testDir and the ignore is lifted; when GATE_SPECS is unset, nothing changes and the suite is
 * exactly the 21 tests of tests/ui and tests/api.
 */
const gateSpecs = process.env.GATE_SPECS;

export default defineConfig({
  testDir: gateSpecs ?? "tests",
  testIgnore: gateSpecs ? [] : ["**/fixtures/**"],
  retries: 0,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "reports/e2e.json" }]],
  use: { baseURL },
  webServer: {
    command: "pnpm app",
    url: baseURL,
    reuseExistingServer: true,
    env: { PORT: String(port) },
  },
});
