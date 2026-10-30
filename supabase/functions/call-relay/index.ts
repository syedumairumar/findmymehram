import {
  authenticate,
  headers,
  limitedBody,
  originAllowed,
  response,
} from "../_shared/http.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: headers(req) });
  if (req.method !== "POST")
    return response(req, { error: "Method not allowed" }, 405);
  if (!originAllowed(req))
    return response(req, { error: "Origin not allowed" }, 403);
  if (Deno.env.get("CALLS_ENABLED") !== "true")
    return response(
      req,
      { error: "Calling is not enabled in this environment." },
      503,
    );
  const keyId = Deno.env.get("CLOUDFLARE_TURN_KEY_ID"),
    apiToken = Deno.env.get("CLOUDFLARE_TURN_API_TOKEN");
  if (!keyId || !apiToken || !/^[-a-zA-Z0-9_]+$/.test(keyId))
    return response(
      req,
      { error: "The relay service is not configured." },
      503,
    );
  try {
    const { db } = await authenticate(req);
    const input = JSON.parse(
      new TextDecoder().decode(await limitedBody(req, 1024)),
    );
    if (
      typeof input.call_id !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(input.call_id)
    )
      return response(req, { error: "Invalid call" }, 400);
    const grant = await db.rpc("claim_call_relay", { call_ref: input.call_id });
    if (grant.error || grant.data !== true)
      return response(
        req,
        {
          error:
            "This call is unavailable or already has relay credentials. Please end it and try again.",
        },
        403,
      );
    const result = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 660 }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!result.ok)
      return response(
        req,
        {
          error:
            "The relay provider is temporarily unavailable. End this call and try again.",
        },
        502,
      );
    const payload = await result.json();
    // Do not return STUN fallback: relay-only WebRTC avoids direct peer IP disclosure.
    const iceServers = (
      Array.isArray(payload.iceServers) ? payload.iceServers : []
    ).flatMap(
      (s: {
        urls?: string[] | string;
        username?: string;
        credential?: string;
      }) => {
        const urls = (
          Array.isArray(s.urls)
            ? s.urls
            : typeof s.urls === "string"
              ? [s.urls]
              : []
        ).filter(
          (url: string) =>
            /^turns?:turn\.cloudflare\.com:\d+(\?transport=(udp|tcp))?$/.test(
              url,
            ) && !url.includes(":53?"),
        );
        return urls.length &&
          typeof s.username === "string" &&
          typeof s.credential === "string"
          ? [{ urls, username: s.username, credential: s.credential }]
          : [];
      },
    );
    if (!iceServers.length)
      return response(
        req,
        { error: "No supported relay servers were returned." },
        502,
      );
    return response(req, { iceServers, expires_in: 660 });
  } catch {
    return response(
      req,
      { error: "Could not authorize this call. Sign in and try again." },
      400,
    );
  }
});
