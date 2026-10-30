import { spawnSync, execFileSync } from "node:child_process";
import { statfsSync } from "node:fs";
import { bindProjectToLoopback } from "./loopback.mjs";
const disk = statfsSync(process.cwd());
if (disk.bavail * disk.bsize < 5 * 1024 ** 3)
  throw new Error(
    "At least 5 GB free disk space is required before starting the local backend.",
  );
const name = "supabase_network_findmymehram";
let network;
try {
  network = JSON.parse(
    execFileSync("docker", ["network", "inspect", name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  )[0];
} catch {
  execFileSync(
    "docker",
    [
      "network",
      "create",
      "--driver",
      "bridge",
      "--label",
      "com.supabase.cli.project=findmymehram",
      "--opt",
      "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
      name,
    ],
    { stdio: "ignore" },
  );
  network = JSON.parse(
    execFileSync("docker", ["network", "inspect", name], { encoding: "utf8" }),
  )[0];
}
if (
  network.Options?.["com.docker.network.bridge.host_binding_ipv4"] !==
  "127.0.0.1"
)
  throw new Error("The project network must bind ports to localhost only.");
// These optional services are excluded from the lightweight core. Edge Functions
// require a separately verified runtime; see the local-development guide.
const result = spawnSync(
  "npx",
  [
    "supabase",
    "start",
    "-x",
    "vector,logflare,imgproxy,supavisor,studio,postgres-meta,edge-runtime",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
if (result.status !== 0) {
  console.error(
    (result.stderr ?? "")
      .split("\n")
      .filter((line) => !/(key|token|secret|password|jwt|bearer)/i.test(line))
      .slice(-15)
      .join("\n"),
  );
  process.exit(result.status ?? 1);
}
const names = execFileSync(
  "docker",
  [
    "ps",
    "--filter",
    "label=com.supabase.cli.project=findmymehram",
    "--format",
    "{{.Names}}",
  ],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
try {
  await bindProjectToLoopback(names);
} catch (error) {
  spawnSync("npx", ["supabase", "stop"], { stdio: "ignore" });
  throw error;
}
for (const container of names) {
  const details = JSON.parse(
    execFileSync("docker", ["inspect", container], { encoding: "utf8" }),
  )[0];
  for (const bindings of Object.values(details.NetworkSettings.Ports ?? {})) {
    for (const binding of bindings ?? []) {
      if (!["127.0.0.1", "::1"].includes(binding.HostIp)) {
        spawnSync("npx", ["supabase", "stop"], { stdio: "inherit" });
        throw new Error(
          `Unsafe local port binding detected on ${container}; the project has been stopped.`,
        );
      }
    }
  }
}
console.log("Verified: project ports are restricted to localhost.");
