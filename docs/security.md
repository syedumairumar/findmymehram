# Security design and release gates

Security is a release requirement. No website can be guaranteed unhackable. This document distinguishes implemented controls from required verification and launch work.

## Implemented in the current source

- React renders member text as text, with no raw HTML injection. Public assets use fingerprinted build names. Fonts are bundled locally.
- The SQL migration denies direct member writes to profiles, memberships, swipes, reports and messages. Privileged operations use explicit authenticated RPC grants, a fixed SQL search path and server-derived actor IDs. The private schema is not exposed through the Data API.
- Incoming likes return an empty identity list to Free members. Membership changes are not granted to browser roles. Match creation is serialized and unique; sending messages requires an active, unblocked mutual match.
- Administrators need a server-assigned role and an `aal2` session. TOTP enrollment and challenge UI uses Supabase Auth. Members who enroll a verified factor must complete 2FA before protected backend operations. Password reset does not remove a factor.
- Local authentication is configured for 12-character passwords, verified email and exact redirect URLs. OAuth providers stay disabled until configured. No SMS cost or SMS-based factor is introduced.
- Browser demo data is fictional and isolated from authenticated backend records. Demo membership/admin controls grant no real privileges. Genuine card/PayPal checkout stays disabled without provider setup.
- CSV exports neutralize formula-leading values. Dependencies are pinned with a lockfile, production audit is clean at the initial build, and CI/Dependabot configuration is included. CI actions are pinned to verified commit SHAs.
- Server secret examples contain placeholders only. Service-role credentials must never enter `VITE_` settings, Git, logs or the browser. Local account fixture credentials and backend environment files are ignored.

The core backend passed 16 direct authorization checks against local Supabase, including genuine TOTP enrollment/verification. Photo-function, calling, payment-provider and hosted-environment checks remain required; a frontend build does not prove those integrations.

## Hosting requirements before exposure

Prefer managed Cloudflare and Supabase services. Enable MFA on GitHub, cloud, database, OAuth and payment-owner accounts. Use least-privilege per-project deployment credentials, separate test/live environments and restricted production access. Keep the database service endpoint private except for the authenticated API; do not expose PostgreSQL or admin tools through a public VM firewall or development tunnel.

Use HTTPS, security headers including a restrictive Content Security Policy, no shared caching of private responses, a verified application origin, short-lived authorized media URLs and redacted logging. Configure platform anti-bot controls and auth rate limits; review observable backend rate limits for all costly operations, not only UI buttons. Avoid public debug/source-map endpoints and do not ship privileged keys.

Enable repository secret scanning/push protection where supported. Review dependency alerts, lockfile changes and CI permissions. Never allow untrusted pull requests to obtain deployment/payment secrets. Require successful checks before deployment; release workflows remain a separate implementation step.

If an Oracle VM is used: SSH keys only, no password/root SSH login, restricted administrative source IPs, minimal open ports, automatic security patches, non-root application processes, read-only containers where possible, resource limits, rotated secrets and monitored backups. Do not mount the Docker socket into the app. Docker itself is not an isolation or security guarantee for an insecure application.

## Required adversarial checks

1. Anonymous and ordinary-member calls to admin functions, private tables and membership updates fail. An admin role without verified 2FA also fails.
2. Free users cannot recover incoming liker identities through direct tables, RPCs, storage metadata or realtime events. Expired premium access is removed on the server.
3. Unmatched users cannot read/send messages or signal calls; unrelated accounts cannot join private channels. Blocking/suspension prevents new interactions. Active media sessions need explicit revocation tests as part of the calling milestone.
4. Concurrent/retried reciprocal likes create one match. Per-account limits cannot be bypassed by changing a browser request or racing calls.
5. Payment callbacks require authentic provider verification and server-side account/plan binding, with idempotency, reconciliation and environment checks. A success URL cannot grant a tier. Sandbox and live data must never mix.
6. Photo uploads require authoritative type/dimension validation, trusted decode/re-encode, file/count limits and ownership enforcement. Client-side checks alone are insufficient. SVG/HTML uploads must be rejected. Do not enable uploads until the trusted server pipeline is verified.
7. Export/deletion is restricted to the requester, with fresh verification for destructive actions and appropriate handling of active subscriptions/retained evidence. No support workflow may silently bypass 2FA.
8. Test backup restoration, incident response, key rotation, security headers and actual hosted access controls before handover for real-user testing.

## Current operational limitation

Docker Desktop was reinstalled from the official Apple Silicon installer as version 4.97.0 after a disk-full failure. Its published SHA-256 and Docker Inc. code signature were verified; the engine and an ephemeral hello-world container passed. Existing non-project images, volumes and settings were preserved. The core Supabase stack is healthy and its published ports were verified as loopback-only. Optional Studio/meta/Edge services remain outside the lightweight local start.
