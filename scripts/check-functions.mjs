import { existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const files = readdirSync("supabase/functions", { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => `supabase/functions/${d.name}/index.ts`)
  .filter((path) => existsSync(path));
execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "--yes",
    "deno@2.9.6",
    "check",
    "--no-config",
    "--no-lock",
    "--node-modules-dir=none",
    ...files,
  ],
  { stdio: "inherit", env: { ...process.env, DENO_NO_PACKAGE_JSON: "1" } },
);
