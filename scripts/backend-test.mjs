import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { localConfig } from "./local-config.mjs";
const c = localConfig(),
  service = createClient(c.API_URL, c.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  }),
  accounts = [];
let checks = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  checks++;
  console.log(`PASS ${label}`);
};
function totp(secret) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.toUpperCase().replace(/=+$/, ""))
    bits += chars.indexOf(ch).toString(2).padStart(5, "0");
  const bytes = Buffer.from(bits.match(/.{8}/g).map((x) => parseInt(x, 2))),
    counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", bytes).update(counter).digest(),
    offset = h[h.length - 1] & 15;
  return String((h.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
try {
  for (let i = 0; i < 3; i++) {
    const email = `security-${randomUUID()}@mehram.test`,
      password = `LocalOnly!${randomBytes(16).toString("base64url")}`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    const client = createClient(c.API_URL, c.ANON_KEY, {
      auth: { persistSession: false },
    });
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw signed.error;
    accounts.push({ id: data.user.id, email, password, client });
    const profile = await client.rpc("save_profile", {
      details: {
        name: `Security fixture ${i}`,
        city: "Test city",
        profession: "Tester",
        bio: "Disposable security fixture",
        interests: [],
        languages: ["English"],
        photo: "",
        gender: "not specified",
        birth_date: "1995-01-01",
        terms_accepted: true,
      },
    });
    if (profile.error) throw profile.error;
  }
  const [a, b, outsider] = accounts;
  const anonymous = createClient(c.API_URL, c.ANON_KEY, {
    auth: { persistSession: false },
  });
  check(
    Boolean((await anonymous.rpc("admin_overview")).error),
    "anonymous admin access rejected",
  );
  check(
    Boolean((await a.client.rpc("admin_overview")).error),
    "ordinary member admin access rejected",
  );
  check(
    Boolean(
      (
        await a.client
          .from("memberships")
          .update({ tier: "diamond" })
          .eq("user_id", a.id)
      ).error,
    ),
    "member cannot grant themselves Diamond",
  );
  check(
    Boolean(
      (
        await a.client.from("subscriptions").insert({
          user_id: a.id,
          provider: "stripe",
          environment: "sandbox",
          tier: "gold",
          status: "active",
        })
      ).error,
    ),
    "member cannot insert a paid subscription",
  );
  check(
    Boolean(
      (
        await a.client.from("payment_events").insert({
          provider: "stripe",
          event_id: "evt_forged",
          environment: "sandbox",
        })
      ).error,
    ),
    "member cannot record a payment webhook event",
  );
  check(
    Boolean((await a.client.from("swipes").select("*")).error),
    "raw likes table is inaccessible",
  );
  await b.client.rpc("record_swipe", { target_id: a.id, liked: true });
  const free = await a.client.rpc("incoming_likes");
  if (free.error) throw free.error;
  check(
    free.data.count >= 1 && free.data.profiles.length === 0,
    "Free incoming likes contain no identities",
  );
  await service
    .from("memberships")
    .update({
      tier: "gold",
      source: "security-test",
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    })
    .eq("user_id", a.id);
  const gold = await a.client.rpc("incoming_likes");
  check(
    gold.data?.profiles.some((p) => p.id === b.id),
    "Gold can read authorized incoming identities",
  );
  await service
    .from("memberships")
    .update({ expires_at: new Date(Date.now() - 10000).toISOString() })
    .eq("user_id", a.id);
  const expired = await a.client.rpc("incoming_likes");
  check(
    expired.data?.profiles.length === 0,
    "expired premium access is removed server-side",
  );
  const [one, two] = await Promise.all([
    a.client.rpc("record_swipe", { target_id: b.id, liked: true }),
    b.client.rpc("record_swipe", { target_id: a.id, liked: true }),
  ]);
  if (one.error || two.error) throw one.error ?? two.error;
  const matches = await a.client.rpc("my_matches");
  if (matches.error) throw matches.error;
  const matching = matches.data.filter((m) => m.profile.id === b.id);
  check(matching.length === 1, "concurrent reciprocal likes create one match");
  const match = matching[0].id;
  check(
    Boolean(
      (
        await outsider.client.rpc("send_message", {
          conversation_id: match,
          body: "Intrusion",
          request_id: randomUUID(),
        })
      ).error,
    ),
    "unrelated member cannot send into a match",
  );
  const unowned = await outsider.client
    .from("messages")
    .select("*")
    .eq("match_id", match);
  check(
    !unowned.error && unowned.data.length === 0,
    "unrelated member cannot read match messages",
  );
  const body = "<img src=x onerror=alert(1)> Literal text only";
  const sent = await a.client.rpc("send_message", {
    conversation_id: match,
    body,
    request_id: randomUUID(),
  });
  if (sent.error) throw sent.error;
  const received = await b.client
    .from("messages")
    .select("*")
    .eq("match_id", match);
  check(
    received.data?.some((m) => m.content === body),
    "matched member can read durable message text",
  );
  check(
    Boolean(
      (
        await outsider.client.rpc("start_call", {
          conversation_id: match,
          wants_video: true,
        })
      ).error,
    ),
    "unrelated member cannot initiate a call",
  );
  const invitation = await a.client.rpc("start_call", {
    conversation_id: match,
    wants_video: false,
  });
  if (invitation.error) throw invitation.error;
  const call = invitation.data.id;
  check(
    invitation.data.receiver_id === b.id,
    "call recipient is derived from the mutual match",
  );
  check(
    Boolean((await a.client.rpc("answer_call", { call_ref: call })).error),
    "caller cannot accept on the recipient's behalf",
  );
  check(
    Boolean(
      (await outsider.client.rpc("answer_call", { call_ref: call })).error,
    ),
    "unrelated member cannot answer a call",
  );
  check(
    Boolean(
      (
        await a.client.rpc("send_call_signal", {
          call_ref: call,
          signal_kind: "offer",
          signal_payload: { type: "offer", sdp: "fixture" },
        })
      ).error,
    ),
    "media negotiation requires recipient acceptance",
  );
  const accepted = await b.client.rpc("answer_call", { call_ref: call });
  if (accepted.error) throw accepted.error;
  const offered = await a.client.rpc("send_call_signal", {
    call_ref: call,
    signal_kind: "offer",
    signal_payload: { type: "offer", sdp: "fixture" },
  });
  if (offered.error) throw offered.error;
  check(
    (await b.client.from("call_signals").select("*").eq("call_id", call)).data
      ?.length === 1,
    "matched recipient can read accepted-call signaling",
  );
  check(
    (await outsider.client.from("call_signals").select("*").eq("call_id", call))
      .data?.length === 0,
    "unrelated member cannot read signaling",
  );
  check(
    Boolean(
      (
        await a.client.rpc("send_call_signal", {
          call_ref: call,
          signal_kind: "answer",
          signal_payload: { type: "answer", sdp: "fixture" },
        })
      ).error,
    ),
    "caller cannot forge the recipient's answer",
  );
  check(
    Boolean(
      (
        await a.client.rpc("send_call_signal", {
          call_ref: call,
          signal_kind: "candidate",
          signal_payload: {
            candidate: "candidate:1 1 UDP 123 192.168.1.2 12345 typ host",
          },
        })
      ).error,
    ),
    "direct host ICE candidate is rejected",
  );
  const relay = await a.client.rpc("claim_call_relay", { call_ref: call });
  const relayAgain = await a.client.rpc("claim_call_relay", { call_ref: call });
  check(
    relay.data === true && relayAgain.data === false,
    "relay credential grants cannot be repeatedly minted",
  );
  await b.client.rpc("block_member", { target_id: a.id });
  check(
    Boolean(
      (
        await a.client.rpc("send_call_signal", {
          call_ref: call,
          signal_kind: "candidate",
          signal_payload: {
            candidate: "candidate:1 1 UDP 123 1.2.3.4 12345 typ relay",
          },
        })
      ).error,
    ),
    "blocking revokes subsequent call signaling",
  );
  check(
    (await a.client.from("call_signals").select("*").eq("call_id", call)).data
      ?.length === 0,
    "blocking revokes signaling reads",
  );
  const ended = await a.client.rpc("end_call", { call_ref: call });
  check(!ended.error, "a blocked participant can still hang up");
  check(
    Boolean(
      (
        await a.client.rpc("send_message", {
          conversation_id: match,
          body: "Blocked",
          request_id: randomUUID(),
        })
      ).error,
    ),
    "blocking prevents subsequent sends",
  );
  check(
    (await a.client.from("messages").select("*").eq("match_id", match)).data
      ?.length === 0,
    "blocking removes direct message access",
  );
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_findmymehram",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      input: `insert into private.admin_roles(user_id,role) values('${outsider.id}','owner');`,
      stdio: ["pipe", "ignore", "pipe"],
    },
  );
  check(
    Boolean((await outsider.client.rpc("admin_overview")).error),
    "server-assigned owner without 2FA is rejected",
  );
  const enrolled = await outsider.client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Automated local security test",
  });
  if (enrolled.error) throw enrolled.error;
  const verified = await outsider.client.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id,
    code: totp(enrolled.data.totp.secret),
  });
  if (verified.error) throw verified.error;
  const removedProfile = await service
    .from("profiles")
    .delete()
    .eq("id", outsider.id);
  if (removedProfile.error) throw removedProfile.error;
  const overview = await outsider.client.rpc("admin_overview");
  check(
    !overview.error && typeof overview.data.total === "number",
    "owner with genuine verified TOTP can administer without a dating profile",
  );
  await outsider.client.auth.signOut();
  await outsider.client.auth.signInWithPassword({
    email: outsider.email,
    password: outsider.password,
  });
  check(
    Boolean((await outsider.client.rpc("admin_overview")).error),
    "signing in with password alone does not bypass enrolled 2FA",
  );
  console.log(`All ${checks} backend authorization checks passed.`);
} finally {
  for (const a of accounts) await service.auth.admin.deleteUser(a.id);
}
