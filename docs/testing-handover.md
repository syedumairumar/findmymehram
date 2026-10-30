# Testing the current release

Open **https://findmymehram.pages.dev/** and select **Explore the demo**. No account is needed for this route. You can share this URL with an adult tester now.

## Available in the fictional demo

- Responsive landing and member navigation.
- Like/pass cards with buttons, pointer gestures and desktop arrow keys.
- Mutual matching and selection of the correct conversation.
- Browser-local chat messages that appear immediately and survive a reload.
- Free/Gold/Diamond previews and hidden incoming identities on Free.
- Editable fictional profile, report/block controls and sample admin screens.
- Draft terms, privacy, cookies and safety information.

The demo explicitly labels fictional profiles, simulated membership changes and sample dashboard data. It does not send messages to real people, charge money or access the microphone/camera. Demo actions remain in that browser; another tester has their own copy.

## Invited real accounts and administration

The production Pages deployment is connected to a dedicated London Supabase test project. Public sign-ups are disabled server-side. Use the owner's manually created test accounts until invitation email is configured. Never share the owner's administrator credentials.

The designated operator has completed genuine authenticator enrollment and reached the real `/admin` dashboard. Operator accounts do not need a public dating profile or member date of birth. Member counts represent completed member profiles, so an operator alone correctly produces zero members.

For subsequent operator sign-ins, enter the password on `/auth`, then verify the authenticator code on `/security`. The server checks both the administrator role and the verified second-factor session before returning privileged data. Demo admin screens cannot grant real permissions.

Real member matching/chat requires at least two invited adults who complete fictional test profiles and mutually like each other. Do not use real sensitive dating information during this incomplete test phase. Photo upload and account deletion Edge Functions are deployed. Their anonymous/origin denial checks are verified; successful authenticated upload/deletion still require runtime verification.

## Remaining integrations

- Genuine Stripe card and PayPal sandbox checkout, verified webhooks and subscription lifecycle. Checkout/webhook functions are in source; they stay disabled until `VITE_PAYMENTS_ENABLED=true`, successful provider sandbox lifecycle tests are complete. Sandbox credentials, Stripe/PayPal webhooks and both providers’ monthly plans are configured; the server also requires `PAYMENTS_ENABLED=true`. The return URL still does not grant a tier.
- Google and Facebook provider apps and callback verification.
- Transactional verification/reset/invitation email. Reset email is visibly unavailable in the hosted pilot until delivery is configured.
- Call relay credentials, actual audio/video tests on separate devices/networks. Calling source and authorization are implemented; it remains disabled and unverified for real media.
- Traffic collection, full account administration, server pagination/advanced reports, operational monitoring/backups and final launch policy review.

This is a test milestone, not a completed public/live service or legal compliance certification.

## Verification recorded on 30 October 2026

- Latest app source is versioned in the owner's GitHub repository and automatically built by Cloudflare Pages.
- GitHub checks passed: TypeScript, 27 unit tests (billing settlement/signatures and CSV security), server entry-point Deno checks, frontend build, dependency audit and six desktop/mobile browser cases.
- Thirty-one direct local backend authorization checks passed, including genuine TOTP, operator access without a member profile, paid-like boundaries, concurrent matching, messaging and call/block authorization.
- Nineteen local billing database checks passed, covering duplicate checkout, event/lease concurrency, rollback, paid entitlement, cancellation and out-of-order reconciliation. These simulate trusted provider snapshots; they are not genuine sandbox purchases.
- Five direct hosted checks passed: public registration disabled; anonymous access denied to admin, raw likes, memberships and calls.
- Actual hosted operator login/TOTP and dashboard were verified by the owner and observed in the browser. Hosted demo matching/chat persistence was also checked directly.
- Five deployed server handlers reject anonymous/disabled requests, and four member handlers reject foreign origins. Both providers’ actual sandbox APIs verified all four monthly prices/plans.
- Homepage returned HTTP 200 with CSP, HSTS, frame protection, content-type protection and camera/microphone restricted to the app origin.
- Docker's core development services remain healthy with published ports bound to loopback.

## Making a change from this computer

Use Node 24 and the [local development guide](local-development.md). Edit locally and run the checks appropriate to the change. Push a feature branch and review its GitHub checks before merging into `main`. The current Cloudflare production build runs type checks and unit tests before building `dist`; branch protection is not configured yet.

This computer currently pushes using the authenticated **Fork** app. Open this repository in Fork, commit the intended files, and use **Push** for the current branch. Do not force-push or push unrelated tags. A CLI `git push` requires a separately configured GitHub credential helper; Fork's saved account is not automatically shared with terminal Git.

Merging/pushing to `main` triggers deployment. Backend migrations and functions require their own verified operator deployment first; see the [deployment runbook](deployment.md). Never upload `.env.local`, fixture credentials or service/payment/TURN secrets.
