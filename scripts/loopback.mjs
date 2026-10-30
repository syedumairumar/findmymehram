import http from "node:http";
import { execFileSync } from "node:child_process";
const inspect = (name) =>
  JSON.parse(
    execFileSync("docker", ["inspect", name], { encoding: "utf8" }),
  )[0];
// Docker cannot update published ports in place. Recreate only this project's
// three published containers, preserving their named volumes and configuration.
export async function bindProjectToLoopback(names) {
  const endpoint = execFileSync(
    "docker",
    ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
    { encoding: "utf8" },
  ).trim();
  if (!endpoint.startsWith("unix://"))
    throw new Error(
      "Local network hardening currently requires a Unix Docker socket (macOS/Linux).",
    );
  function api(method, path, body) {
    return new Promise((resolve, reject) => {
      const data = body === undefined ? undefined : JSON.stringify(body);
      const req = http.request(
        {
          socketPath: endpoint.slice(7),
          method,
          path,
          headers: data
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data),
              }
            : {},
        },
        (res) => {
          let text = "";
          res.on("data", (c) => (text += c));
          res.on("end", () => {
            if (res.statusCode >= 400)
              reject(
                new Error(
                  `Docker ${method} ${path} failed (${res.statusCode})`,
                ),
              );
            else resolve(text ? JSON.parse(text) : null);
          });
        },
      );
      req.on("error", reject);
      req.setTimeout(30000, () =>
        req.destroy(new Error("Docker API timed out.")),
      );
      req.end(data);
    });
  }
  for (const name of names.sort(
    (a, b) =>
      Number(b.startsWith("supabase_db_")) -
      Number(a.startsWith("supabase_db_")),
  )) {
    const old = inspect(name);
    const unsafe = Object.values(old.NetworkSettings.Ports ?? {})
      .flatMap((x) => x ?? [])
      .some((b) => !["127.0.0.1", "::1"].includes(b.HostIp));
    if (!unsafe) continue;
    if (
      ![
        "supabase_db_findmymehram",
        "supabase_kong_findmymehram",
        "supabase_inbucket_findmymehram",
      ].includes(name)
    )
      throw new Error("Unexpected project port mapping; stopped for review.");
    if (old.HostConfig.Links?.length)
      throw new Error(
        "Legacy linked containers cannot be safely rebound by this script.",
      );
    const host = { ...old.HostConfig };
    for (const bindings of Object.values(host.PortBindings ?? {}))
      for (const b of bindings ?? []) b.HostIp = "127.0.0.1";
    // Supabase injects Kong's generated configuration into its writable layer,
    // rather than a volume. Preserve it in memory; it contains local API keys.
    const kongConfig =
      name === "supabase_kong_findmymehram"
        ? execFileSync("docker", ["cp", "-a", `${old.Id}:/home/kong/.`, "-"], {
            stdio: ["ignore", "pipe", "pipe"],
          })
        : null;
    const networks = Object.fromEntries(
      Object.entries(old.NetworkSettings.Networks).map(([key, value]) => [
        key,
        { NetworkID: value.NetworkID, Aliases: value.Aliases },
      ]),
    );
    await api("POST", `/containers/${old.Id}/stop?t=15`);
    await api(
      "POST",
      `/containers/${old.Id}/rename?name=${name}-before-loopback`,
    );
    const created = await api("POST", `/containers/create?name=${name}`, {
      ...old.Config,
      HostConfig: host,
      NetworkingConfig: { EndpointsConfig: networks },
    });
    if (kongConfig)
      execFileSync("docker", ["cp", "-a", "-", `${created.Id}:/home/kong`], {
        input: kongConfig,
        stdio: ["pipe", "ignore", "pipe"],
      });
    await api("POST", `/containers/${created.Id}/start`);
    let healthy = false;
    for (let i = 0; i < 60; i++) {
      const state = inspect(name).State;
      if (
        state.Status === "running" &&
        (!state.Health || state.Health.Status === "healthy")
      ) {
        healthy = true;
        break;
      }
      if (state.Status === "exited") break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!healthy)
      throw new Error(
        `The ${name} container did not become healthy after restricting its ports.`,
      );
    await api("DELETE", `/containers/${old.Id}`);
  }
}
