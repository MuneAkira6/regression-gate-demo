// Vitest runs the self-tests only. Without this, its default glob (`**/*.spec.ts`) also picks up the
// Playwright specs under tests/, which fail on import with "Playwright Test did not expect test() to
// be called here". SCOPE.md puts the self-tests in `test/*.test.ts`, so that is the include.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The gate's self-tests each start an app and run a real Playwright process. Two Playwright runs
    // at once is not allowed, and Vitest runs test *files* in parallel by default, so file
    // parallelism is off: one gate run at a time, whatever order the files are in.
    fileParallelism: false,
  },
});
