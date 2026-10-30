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

- Additional provider renewal, declined/3DS payment, dispute and PayPal refund cases. The successful purchase/cancellation flows and Stripe full refund are verified; those do not substitute for every lifecycle scenario.
- Google and Facebook provider apps and callback verification; both are disabled in the hosted project.
- Transactional verification/reset/invitation email. Branded confirmation/recovery templates are prepared, but the hosted SMTP sender is not configured and reset email is visibly unavailable.
- Cloudflare TURN credentials and actual audio/video tests on separate devices/networks. Calling source and authorization are implemented; it remains disabled and unverified for real media.
- Traffic collection, full account administration, server pagination/advanced reports, operational monitoring/backups and final launch policy review.

This is a test milestone, not a completed public/live service or legal compliance certification.

## Verification recorded on 30 October 2026

- Latest app source is versioned in the owner's GitHub repository and automatically built by Cloudflare Pages.
- GitHub checks passed: TypeScript, 27 unit tests (billing settlement/signatures and CSV security), server entry-point Deno checks, frontend build, dependency audit and eight desktop/mobile browser cases, including delayed profile restoration.
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

## Genuine sandbox billing verified

Both `VITE_PAYMENTS_ENABLED` and server `PAYMENTS_ENABLED` are enabled on this invitation-only test deployment, with server `PAYMENTS_ENVIRONMENT=sandbox`. The server rejects live Stripe keys and uses PayPal's sandbox API exclusively.

A separately created, non-admin tester completed its profile and purchased Gold (£9.99/month test amount) through Stripe Checkout using Stripe's published test card. The app received Gold from verified provider state. In-app cancellation stopped renewal and preserved paid access. An operator-issued full sandbox refund and immediate provider cancellation then returned the app to Free.

The same tester subsequently approved Diamond (£19.99/month test amount) using an existing fictional PayPal sandbox buyer. A completed GBP sale was verified by the provider API, recorded in the application, and granted Diamond. In-app cancellation stopped PayPal renewal while preserving access through the verified paid period. No real funds moved. Both test subscriptions have renewal stopped.

There can be a short interval between provider approval and settlement/webhook reconciliation. The billing return screen retries verification for a bounded period and offers manual Refresh billing status. It does not grant access from URL parameters. After confirmation it removes provider return parameters from the address bar.

The owner created and controls the tester's password; it is not in Git or this document. Never share the owner/admin account with testers. To test as a different person, manually create an invited test account until email delivery is configured, or use the browser-local fictional demo without credentials.
