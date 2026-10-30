import { execFileSync } from "node:child_process";
export function localConfig() {
  let output;
  try {
    output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      "The local Supabase stack is not running. Run npm run backend:start first.",
    );
  }
  const config = {};
  for (const line of output.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match)
      config[match[1]] = match[2].startsWith('"')
        ? JSON.parse(match[2])
        : match[2];
  }
  const url = new URL(config.API_URL);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "54321"
  )
    throw new Error(
      "This script is restricted to the local backend on port 54321.",
    );
  if (!config.ANON_KEY || !config.SERVICE_ROLE_KEY)
    throw new Error("Local backend keys are unavailable.");
  return config;
}
