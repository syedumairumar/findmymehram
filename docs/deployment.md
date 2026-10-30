# Deployment and rollback

Status: invitation-only hosted test deployment. The GitHub repository is https://github.com/syedumairumar/findmymehram and is linked locally as `origin`. The owner created it as public; preserve that audience unless the owner requests a change. A Cloudflare Pages project named `findmymehram` and London Supabase test project `nyhohhdleovhbxwafxpn` exist. The core schema was applied through the SQL Editor; the first frontend is deployed at https://findmymehram.pages.dev/ as an explicit fictional demo. No secret is recorded here. The default is Cloudflare Pages plus Supabase; the main plan documents the optional Oracle/Docker alternative.

## Verified hosting configuration

- Cloudflare Pages: `findmymehram`, connected to `syedumairumar/findmymehram`, production branch `main`.
- Build: `npm run typecheck && npm test && npm run build`; output: `dist`; `NODE_VERSION=24`.
- Assets and self-hosted fonts are served through the Pages CDN.
- Production build variables now point to the dedicated test Supabase project using its public publishable key. `VITE_INVITE_ONLY=true`; password-reset email, calls and both OAuth providers remain disabled pending integration. `VITE_PAYMENTS_ENABLED=true` enables sandbox checkout for invited members. The ignored local `.env.local` is not uploaded. Branch previews have no backend variables and remain fictional demos.
- Supabase project: `nyhohhdleovhbxwafxpn`, London. Migrations `202610300001` (core), `202610300002` (calls) and `202610300003` (operator access) were applied in transactions through SQL Editor. `202610300004` (billing reconcile) was also applied transactionally in SQL Editor on 30 October 2026. The hosted project has no CLI migration-history table yet. Before the first CLI `db push`, verify schema equivalence and register those revisions with `supabase migration repair 202610300001 202610300002 202610300003 202610300004 --status applied --project-ref nyhohhdleovhbxwafxpn` against this exact project, to avoid replaying the schema.
- Pushes to `main` trigger a new frontend build. Branch protection and automatic backend/function deployment are not configured yet. GitHub browser checks run separately and must be reviewed before handover.

Hosted Auth configuration was checked: public sign-ups, anonymous sign-ins and manual linking are off; email confirmation and TOTP are on; minimum passwords are 12 characters; secure password change is on; email OTP expiry is 600 seconds. Site URL is the Pages origin. Redirects are restricted to `/profile`, `/auth?mode=update` and `/security` on that origin. Five direct hosted checks verified disabled sign-ups and anonymous denial for admin, swipes, memberships and calls. The designated operator was created by the owner, assigned an owner role and successfully completed hosted login/TOTP to reach the genuine admin dashboard.

## Environments

| Environment | App/backend | Payments | Data |
| --- | --- | --- | --- |
| Local | Vite plus local Docker-backed Supabase | Fixtures or explicit provider sandboxes | Fictional local seed |
| Hosted test | Cloudflare Pages plus dedicated Supabase test project | PayPal and Stripe sandboxes | Fictional profiles and invited testers |
| Live, later | Separately configured app/backend | Approved live merchant credentials | Real users under reviewed operating policies |

Initially the test site may be the Pages project's production deployment; this means the main deployed branch, not live money. Keep a prominent testing badge. Branch previews must use explicitly assigned test configuration and never a live backend. Verify provider free-project limits before creating extra backend environments.

## GitHub and release workflow

Use the existing `syedumairumar/findmymehram` repository; do not create a duplicate. Keep source, docs, database migrations and functions together; do not commit secrets, backups, real profiles or uploaded private photos. Use feature branches and PRs; record released commit SHAs and make issue tracking available.

Implement CI that installs from the lockfile, type-checks, runs meaningful tests, applies migrations to a disposable local backend and builds the frontend. Never expose cloud/provider secrets to untrusted fork PRs. Where GitHub's plan supports it, require checks on the release branch; otherwise enforce the same condition inside the deploy workflow.

Cloudflare Pages owns frontend deployment from the connected GitHub repository. Its build command must run type checks and unit checks before building `dist`. GitHub Actions performs additional checks, including browser specs; require those checks before merging when branch protection is configured. Apply compatible database migrations and functions separately before merging frontend code that depends on them. Pin actions and scope integration access to this repository.

## Initial setup and required secrets

Create owner-controlled Cloudflare and Supabase projects, select the backend region, configure mail delivery/OAuth redirect allowlists and attach provider sandbox apps/webhooks. Store server secrets in the backend secret manager and deployment credentials in GitHub environment/repository secrets. Put only intentionally public configuration in the frontend build.

Record the deployed URL, environment, project references and callback paths in non-secret documentation. Record private credentials in the designated secret stores. Never place account access tokens, service-role keys, payment secrets or TURN master credentials in Git, frontend variables or release logs.

## Deploying a change

1. Edit locally, add a migration for schema changes, run checks and push a feature branch.
2. Review the PR preview against the isolated test backend. Validate schema changes locally before deployment; avoid destructive changes in a shared preview backend.
3. Merge the reviewed commit. The release workflow verifies checks and takes a backup appropriate to the change.
4. Apply backward-compatible hosted migrations and deploy required server functions/secrets. Do not continue with a frontend that requires a failed backend release.
5. Build and publish the frontend with the matching environment's public settings. Record its commit SHA, backend migration revision and provider mode.
6. Run smoke checks: authentication, cards/likes, matching, chat, admin authorization and sandbox payment/webhook status. Report failure and retain a clear rollback path.

During initial provisioning, operator backend commands are anticipated to include:

```sh
npx supabase link --project-ref "$APP_SUPABASE_PROJECT_REF"
npx supabase db push
npx supabase functions deploy
npm run build
```

These are planned operations, not an instruction to run them against an unspecified project. Fill the actual function list, frontend publish command and credentials mechanism during implementation. Verify the linked project and environment before any hosted mutation. CI should use explicit project references, not depend on a developer's last local link.

## Rollback

Keep previous frontend deployments and redeploy the last known good artifact/commit. Keep compatible server versions available. Revert application code through Git so the next release does not accidentally reintroduce the failure.

Database rollback is a separate operation: prefer a forward corrective migration and preserve data. A frontend rollback does not reverse migrations or payment events. Destructive restoration requires an impact assessment and a verified backup; never run local `db reset` against hosted data. Test restore and application rollback before handover.

## Moving from sandbox to live

The owner must have approved merchant accounts for the actual dating business. Create live products/plans, register live webhooks, configure distinct signing secrets and permitted return/callback URLs, confirm currency/prices/tax/cancellation disclosures, then run the provider's go-live checks. Replacing one API key is insufficient. Existing sandbox customers and subscriptions must never be treated as live payments.

Keep sandbox credentials out of the live deployment and make the server reject a mismatched provider environment. Decide the release and rollback policy before accepting real charges; rolling back code must not duplicate payment creation or discard subscription state.

## Server deployment recorded on 30 October 2026

Deployed `billing`, `billing-webhook`, `photo-upload`, `account-delete` and `call-relay` through the Supabase dashboard. For the dashboard editor, the local modules were bundled to one ESM file per entry point using `esbuild@0.25.12`, preserving external pinned `npm:` imports and `node:` built-ins. Repository TypeScript is the source of truth; normal CLI deployment can bundle it directly.

The owner approved disabling the legacy JWT gateway check for these functions. Member handlers call Supabase Auth `getUser` and enforce verified email/enrolled TOTP; the external payment handler validates provider signatures. The matching `verify_jwt=false` entries are versioned in `supabase/config.toml`.

`APP_ORIGINS` and `APP_URL` are the exact Pages origin. Server `PAYMENTS_ENABLED=true` with `PAYMENTS_ENVIRONMENT=sandbox` enables verified sandbox billing. `CALLS_ENABLED=false` keeps actual calls disabled. Stripe monthly price IDs are stored as function configuration. Sandbox provider secrets, plan references and both webhooks are now configured; both genuine purchases, both cancellations and a full Stripe refund have been verified. Renewal, decline, 3DS and dispute end-to-end cases remain outstanding. Keep live payment keys rejected and public registration disabled during the pilot.

For future function releases after authenticating the CLI, use the exact test reference:

```sh
npx supabase functions deploy billing --project-ref nyhohhdleovhbxwafxpn
npx supabase functions deploy billing-webhook --project-ref nyhohhdleovhbxwafxpn
npx supabase functions deploy photo-upload --project-ref nyhohhdleovhbxwafxpn
npx supabase functions deploy account-delete --project-ref nyhohhdleovhbxwafxpn
npx supabase functions deploy call-relay --project-ref nyhohhdleovhbxwafxpn
```

Migration history must be reconciled against the actual hosted schema before the first CLI database push. Do not rerun migrations 001–004 in SQL Editor or use `db reset` on this project.

The sandbox billing release was merged in PR #3 (`3aebbc0`), followed by the protected-route restoration fix in PR #4 (`24e4c9d`). Both passed GitHub checks and were deployed by Pages. Payment return URLs are preserved during session/profile restoration; the subsequent billing retry change clears provider return parameters after confirmed settlement.
