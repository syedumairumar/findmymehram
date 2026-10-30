import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { localConfig } from "./local-config.mjs";
const config = localConfig();
let text = readFileSync(
  existsSync(".env.local") ? ".env.local" : ".env.example",
  "utf8",
);
if (existsSync(".env.local")) {
  const existing = text.match(/^VITE_SUPABASE_URL=(.*)$/m)?.[1];
  if (
    existing &&
    !existing.includes("127.0.0.1") &&
    !existing.includes("localhost")
  )
    throw new Error(
      "Refusing to overwrite a hosted backend configuration. Move .env.local aside first.",
    );
}
for (const [key, value] of Object.entries({
  VITE_SUPABASE_URL: config.API_URL,
  VITE_SUPABASE_ANON_KEY: config.ANON_KEY,
})) {
  const line = new RegExp(`^${key}=.*$`, "m");
  text = line.test(text)
    ? text.replace(line, `${key}=${value}`)
    : `${text}\n${key}=${value}\n`;
}
writeFileSync(".env.local", text, { mode: 0o600 });
console.log(
  "Configured .env.local for the local backend. No server secrets were copied into the frontend.",
);
