// The control sheet, loaded without `resolveJsonModule` (the given tsconfig.json does not set it, and
// tsconfig.json is not ours to change). `n` is per control, because how long a control needs to
// settle is a property of that control.

import { readFileSync } from "node:fs";

const controls = JSON.parse(
  readFileSync(new URL("./controls.json", import.meta.url), "utf8"),
) as Record<string, number>;

export function stableReadN(control: string): number {
  const n = controls[control];
  if (typeof n !== "number") {
    throw new Error(`tests/controls.json has no n for the control "${control}"`);
  }
  return n;
}
