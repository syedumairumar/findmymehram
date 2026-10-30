# Deployment and rollback

Status: deployment design. The GitHub repository is https://github.com/syedumairumar/findmymehram and is linked locally as `origin`. The owner created it as public; preserve that audience unless the owner requests a change. No Cloudflare project, backend project or pipeline is configured yet. Replace that status only after verifying each resource. The default is Cloudflare Pages plus Supabase; the main plan documents the optional Oracle/Docker alternative.

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

Choose one release owner: a gated GitHub Actions workflow. It publishes preview and main frontend artifacts with Cloudflare tooling only after checks pass. Avoid a second automatic Cloudflare Git deployment that can race CI or skip backend steps. Pin official actions and tools; scope each deployment credential to its intended project.

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
