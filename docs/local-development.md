# Local development

Status: planned workflow, not yet executable. The repository currently contains documentation only. Implement and verify the commands below when scaffolding the app, then record tested runtime versions and a clean-clone verification date here.

## Required implementation

Pin a supported Node.js LTS release, npm version, Supabase CLI and all dependencies. Commit `.nvmrc`, `package.json`, lockfile, `supabase/config.toml`, migrations, fictional seed data and `.env.example`. Document Docker runtime installation for macOS/Windows/Linux; use a runtime whose licence fits the owner's use.

Frontend scripts must include `dev`, `build`, `typecheck`, `test` and `test:e2e`. Backend and integration tests must verify access policies and payment state changes, not just UI rendering. Define an idempotent development-only seed command for local storage/auth fixtures. Never ship a shared administrator password or run test seeds against hosted/live data.

## Fresh clone workflow — to be validated

After an authenticated clone of the private GitHub repository, open its root and run:

```sh
nvm install
nvm use
npm ci
cp .env.example .env.local
npx supabase start
npx supabase db reset
npm run dev
```

Start Docker before `supabase start`. `db reset` is destructive to the local development database; use it only for disposable local fixtures. The CLI must be pinned as a dev dependency so `npx` uses the intended version. Do not use `--linked` or remote flags when resetting local data.

Fill frontend `.env.local` values using the local backend URL and publishable key. Write the exact development URL and local mail-preview URL printed by the implemented tools into this guide. Do not post the CLI's privileged credentials in screenshots, commits or support messages.

Run backend functions using the implemented local function command, anticipated to be:

```sh
npx supabase functions serve --env-file supabase/.env.local
```

Supply a separately documented, ignored `supabase/.env.local` for server secrets. Never prefix secret keys with `VITE_`, which exposes values in the browser build. The checked-in example files must list purpose, environment and whether each value is public or secret, including database/auth, OAuth, payment and TURN configuration.

## Local testing modes

- **Local core:** fictional users/profiles, local auth, migrations, storage fixtures and realtime; capture verification/reset emails in the local mail preview. Backend core workflows should not need a hosted Supabase account.
- **Provider sandbox:** PayPal sandbox and Stripe sandbox checkout, test renewals/failures and verified webhooks. These need internet access and owner-controlled sandbox accounts. Any mock mode must be visibly labelled and cannot count as proof the provider integration works.
- **Social login:** separate development OAuth applications/redirect allowlists and Facebook tester roles. Provider sign-in is not an offline feature.
- **Calling:** localhost can exercise camera/microphone, but real acceptance needs two devices on separate networks with TURN. For another phone, use a documented HTTPS development tunnel or trusted local certificate setup; plain HTTP on a LAN address may not support required browser APIs.

## Payment webhook development

For Stripe, document installation/login for its official CLI and forwarding to the exact implemented function route. PayPal needs a reachable HTTPS development endpoint registered with its sandbox app. Use an ephemeral development tunnel restricted to the required route, and terminate it after testing. Neither provider should send sandbox callbacks into live data.

Preserve provider signature-verification inputs, including the raw request body where required. Use the actual secrets/webhook IDs for the receiving endpoint. Never disable signature verification just to make local tests pass. Provider simulators and authentic sandbox transactions must be distinguished in the test report.

## Everyday edit and check workflow

```sh
git switch -c feature/short-description
npm run dev
npm run typecheck
npm test
npm run test:e2e
npm run build
git add <explicit-files>
git commit -m "Describe the change"
git push -u origin feature/short-description
```

The `<explicit-files>` placeholder must be replaced with reviewed paths. These npm scripts do not exist yet. Run relevant local backend/policy tests before a PR. Open the PR and use its preview URL before merging. Keep migrations in Git; avoid dashboard-only schema edits that a fresh clone cannot reproduce.

## Handover verification

A developer must follow this guide from a fresh clone, start the complete core app, preview a reset email, create a match, send a message and open the authorized admin portal. Record prerequisites, commands, URLs and any provider-only limitations. Add troubleshooting for Docker not running, port conflicts, paused hosted projects, OAuth callbacks, missing mail and payment callbacks. Provide stop/restart instructions without deleting persistent local data.
