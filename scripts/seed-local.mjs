import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { localConfig } from "./local-config.mjs";
const c = localConfig(),
  admin = createClient(c.API_URL, c.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  }),
  file = ".local-test-accounts.json";
if (existsSync(file)) {
  console.log(
    "Local fixture credentials already exist. Reuse them, or reset the disposable backend and remove the credentials file before reseeding.",
  );
  process.exit(0);
}
const profiles = [
  [
    "Omar",
    "London, UK",
    "Entrepreneur",
    "man",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80",
  ],
  [
    "Zara",
    "London, UK",
    "Architect",
    "woman",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
  ],
  [
    "Aisha",
    "Manchester, UK",
    "Doctor",
    "woman",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
  ],
  [
    "Meera",
    "Birmingham, UK",
    "Designer",
    "woman",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
  ],
  [
    "Arjun",
    "Edinburgh, UK",
    "Engineer",
    "man",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80",
  ],
];
const accounts = [];
for (const [name, city, profession, gender, photo] of profiles) {
  const email = `${name.toLowerCase()}@mehram.test`,
    password = `LocalOnly!${randomBytes(16).toString("base64url")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(c.API_URL, c.ANON_KEY, {
    auth: { persistSession: false },
  });
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  const saved = await client.rpc("save_profile", {
    details: {
      name,
      city,
      profession,
      gender,
      bio: "Fictional local test profile. Here for a thoughtful connection.",
      interests: ["Travel", "Cooking", "Photography"],
      languages: ["English"],
      intention: "A serious relationship",
      photo: "",
      birth_date: "1997-05-15",
      terms_accepted: true,
    },
  });
  if (saved.error) throw saved.error;
  const updated = await admin
    .from("profiles")
    .update({ photo })
    .eq("id", data.user.id);
  if (updated.error) throw updated.error;
  accounts.push({ name, email, password, id: data.user.id });
  await client.auth.signOut();
}
const owner = accounts[0].id;
if (!/^[0-9a-f-]{36}$/.test(owner)) throw new Error("Unexpected fixture id.");
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
    input: `insert into private.admin_roles(user_id,role) values('${owner}','owner') on conflict(user_id) do nothing;`,
    stdio: ["pipe", "ignore", "pipe"],
  },
);
writeFileSync(
  file,
  JSON.stringify(
    {
      notice:
        "LOCAL FICTIONAL ACCOUNTS ONLY. Never deploy these accounts or publish this file.",
      api: c.API_URL,
      accounts,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  "Created five fictional local accounts. Credentials are in the ignored .local-test-accounts.json file. Omar has the owner role; genuine TOTP enrollment/verification is still required for admin access.",
);
