// A gate fixture with no test in it, on purpose. Playwright answers `Error: No tests found.` and
// writes no JSON report, so the gate must treat the unrun unit as an input error (exit 3) rather than
// crash or silently report a green unit.
