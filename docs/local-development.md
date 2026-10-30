# Local development

Use Node 24, npm and Docker. `.nvmrc` pins the Node major version; install exact dependencies with `npm ci`. Initial unit verification used Node 24.22.2, and local backend verification used Docker Desktop 4.97.0 on Apple Silicon.

## Fictional preview

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173 and choose **Explore the demo**. With no `.env.local`, no backend is required. Fictional swipes, messages, reports and tier previews stay in browser local storage. Messages do not reach another person; demo tier changes are not payments. My profile → Reset demo resets content; Log out removes the active demo. Never enter sensitive real information in the demo.

## Real local accounts

Start Docker, then:

```sh
npm run backend:start
npm run backend:env
npm run backend:seed
npm run dev
```

The startup wrapper starts the core services, restricts published project ports to localhost and verifies their final bindings. It preserves named volumes and Kong configuration while recreating this project's published containers. The CLI initially publishes its default development ports before restriction; use a trusted development network/host firewall during bootstrap. The wrapper stops the project if hardening fails. Final `docker ps` mappings must start with `127.0.0.1:`.

The core includes PostgreSQL, Auth, REST, Realtime, private Storage, Kong and local email capture. Studio, postgres-meta, analytics, image proxy, pooling and Edge runtime are excluded from the lightweight start. Edge Functions need a separately verified runtime/deployment; photo upload and account deletion are not fully available locally without them.

`backend:env` writes only the local public API URL and anon key into ignored `.env.local`. It refuses to overwrite a hosted configuration. No service-role key goes into browser variables. Restart Vite after environment changes.

The seed creates five fictional local accounts with random passwords in the ignored, permission-restricted `.local-test-accounts.json`. Open that file locally for credentials. Omar has the owner role, but must enroll and verify a real authenticator at `/security` before `/admin` works. Fixture scripts are guarded to the local API on port 54321.

| Service | URL |
| --- | --- |
| App | http://127.0.0.1:5173 |
| API | http://127.0.0.1:54321 |
| Verification/reset email preview | http://127.0.0.1:54324 |
| PostgreSQL | 127.0.0.1:54322; use CLI status locally for credentials |

`npm run backend:stop` preserves local data. `npm run backend:reset` destroys the disposable local database and reapplies migrations; never add remote/linked flags to a local reset. Remove the old ignored fixture-credential file before reseeding a reset database.

## Verification

```sh
npm run typecheck
npm test
npm run backend:test
npm run build
```

Backend tests create and remove disposable local users. Initial checks covered admin denial, membership self-escalation, hidden likes, premium expiry, unique concurrent matching, message isolation, blocking and genuine TOTP enforcement.

Browser specs are in `tests/e2e`. Install their browsers with `npx playwright install chromium webkit`, then run `npm run test:e2e` on your machine/CI. Record separately whether that automated suite actually ran; unit checks alone are not end-to-end verification.

## External dependencies

Google/Facebook remain disabled until provider applications and exact callbacks are configured. Hosted verification/recovery needs an approved transactional SMTP sender. Genuine PayPal/card checkout needs function secrets, Stripe/PayPal webhook URLs and `VITE_PAYMENTS_ENABLED=true`; `npm run paypal:plans` can create sandbox plans after PayPal credentials are in `supabase/.env.local`. Audio/video calls remain a separate integration. Demo tier switching and call controls do not constitute those integrations.

Server-only placeholders are in `supabase/.env.example`. Keep real values in ignored `supabase/.env.local` or hosted secret settings, never in `VITE_` variables or Git.

## Docker recovery

A disk-full failure damaged cached Docker snapshots. Docker Desktop was replaced with the checksum/signature-verified official 4.97.0 installer; the engine and hello-world passed. An official single-platform AMD64 Storage image was exported/reloaded to bypass the damaged ARM snapshot. This local emulation workaround is not a production architecture choice. Optional Studio/meta images remained incompatible and are excluded. Other projects' images/volumes were preserved.

Keep disk headroom: startup rejects less than 5 GB free, and fresh image downloads can require substantially more. Do not factory-reset Docker or prune unrelated projects to follow this guide.

## Editing

Use feature branches, relevant checks, reviewed commits and preview URLs. A frontend build does not deploy SQL migrations or configure provider accounts. Follow the deployment guide for those steps.

Billing database checks: `npm run backend:billing-test` uses disposable local accounts and validates atomic reconciliation and subscription boundaries. It refuses a non-loopback backend. This does not substitute for real provider sandbox purchases.
