# Find My Mehram — implementation and hosting plan

Prepared and updated 30 October 2026. Status: planning and repository preparation only; no application, cloud account, VM or deployment has been created. Local development, deployment documentation, a full administration portal and provider sandbox subscriptions are required deliverables.

## 1. Intended outcome and assumptions

Deliver an HTTPS URL that the owner's uncle can open on a phone or desktop to test registration, discovery, matching, three membership tiers, messaging and one-to-one audio/video calls. Deliver the source, migrations, deployment instructions, test checklist and an administrator account as well.

Working assumptions: an adults-only, Pakistani/Indian culturally informed dating and relationship service, initially tested by invited adults in the UK. English first; design for future Urdu/Hindi translations and right-to-left layouts. Do not assume that all members share a religion or want family involvement. Confirm dating versus marriage positioning, operator identity, launch countries and pricing before public launch. Cultural styling and optional language, relationship intention and background fields should be respectful; sensitive fields need a documented purpose and consent approach.

The first URL is a private test release with clearly fictional profiles and sandbox memberships. It is not an unrestricted public dating service. Test accounts and any real personal data still need appropriate handling.

## 2. Recommended architecture

Use a responsive React application with a pre-rendered public landing page, TypeScript, Vite, Tailwind CSS, accessible components, React Router and TanStack Query. Host the generated static files on Cloudflare Pages. Use Supabase's managed PostgreSQL, Auth, Storage, Realtime and Edge Functions for the backend. Keep privileged workflows in SQL transactions or authenticated server functions.

This separates frontend delivery from database and media workloads without introducing multiple application services. PostgreSQL is a practical fit for reciprocal likes, unique matches, memberships, reports and message histories. It offers a migration path to larger managed database instances or another PostgreSQL provider. Auth, realtime and storage migrations still require work; portability is not automatic.

Use a London database region when available. This is a residency preference, not a promise that every subprocessor, CDN request or operational log stays in the UK. Review processor agreements and transfers separately. [Supabase regions](https://supabase.com/docs/guides/platform/regions), [data residency and transfers](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq).

### CDN and media

- Serve versioned scripts, styles, fonts and public illustrations through Cloudflare's CDN. Static asset requests on Pages are currently free and unlimited; server functions have separate quotas. [Cloudflare pricing](https://developers.cloudflare.com/pages/functions/pricing/).
- Serve profile images from private Supabase Storage buckets using its CDN and short-lived authorized URLs. Signed URLs are bearer credentials until expiry. Set short lifetimes and document deletion/cache-expiry behaviour; do not promise that blocking can retract an already downloaded image. [Storage CDN](https://supabase.com/docs/guides/storage/cdn/fundamentals), [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).
- Generate small image variants, validate content type and dimensions, cap file size/count and strip location metadata. Client compression helps responsiveness; trusted processing must enforce the final restrictions. Lazy-load images and preload only the next few cards.
- Keep private API responses, messages, likes, consent records and account details out of public/shared caches. Never put privileged secrets in the frontend bundle.

### Firebase explained

Firebase is Google's managed backend platform: it can supply login, a document database, file storage and hosting so the developer does not operate those servers. It can scale well, but query shape, read volume and billing need care. It is a valid alternative, not a required layer on top of Supabase.

Firebase Cloud Storage now requires the billing-enabled Blaze plan, even though eligible usage can remain free. Profile photos therefore make it less suitable for a strict no-billing pilot. Recommend Supabase for this application's relational data and initial cost constraints. [Firebase storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

## 3. Free hosting and VM decision

### Default: Cloudflare Pages plus Supabase Free

Target zero hosting spend for a small invited test, within provider limits. Use the supplied Pages subdomain and HTTPS; a purchased domain is optional for the web URL. Supabase Free currently includes a 500 MB database, 1 GB file storage, 50,000 monthly active users and limited egress. Inactive free projects can pause after one week and automatic backups are not included. These quotas do not establish the app's supported concurrency. [Supabase pricing](https://supabase.com/pricing).

Monitor database size, media egress, realtime connections/messages, function invocations and email/call usage. Keep test cohorts small, compress images and set app-level upload/call limits. Review current quotas at provisioning and before inviting more users. Back up encrypted database and storage copies to owner-controlled storage and verify restoration. Do not claim free-tier uptime or a production service-level guarantee.

### Oracle: the VM alternative

If a VM remains a requirement, prefer an Oracle Always Free Ampere A1 instance, subject to account eligibility and regional capacity. Current documentation lists an aggregate 2 OCPUs and 12 GB RAM for an Always Free tenancy; older tutorials quoting 4/24 are outdated. Idle instances may be reclaimed. [Oracle limits and reclamation](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

Provision in an appropriate home region, verify the Always Free label and all storage/network allowances, install Ubuntu, use SSH keys, restrict administrative access and enable firewall rules, patches and monitoring. Docker Compose can run a Caddy reverse proxy and a small API or coturn relay. Serve static files through the CDN. Keep the managed backend initially rather than self-hosting the entire Supabase suite on a single VM. Provide reproducible setup and backups; a single VM is a failure point and does not automatically scale horizontally.

Docker packages software consistently; it does not provide autoscaling or free infrastructure. Use Docker for the local Supabase environment and any VM services. The default managed deployment does not need production Docker or Kubernetes.

### Google Cloud comparison

Compute Engine's free VM allowance is an e2-micro in specified US regions, with restricted disk and outbound transfer. Ordinary external IPv4 addresses are separately priced, so a conventional public VM is not reliably a zero-cost configuration. This makes it a weaker fit than the managed default or Oracle for this pilot. [Google free program](https://docs.cloud.google.com/free/docs/free-cloud-features), [network pricing](https://cloud.google.com/vpc/network-pricing).

Trial credits are not recurring free hosting. Do not enable paid upgrades to bypass capacity or quotas without the owner's direction. Budget alerts are notifications, not hard spending caps.

## 4. Feature specification

### Landing and profiles

- Branded landing/splash page, explanation of matching, tier comparison, safety guidance and policy links.
- Mobile-first discovery cards with touch gestures, visible Like/Pass buttons, keyboard controls and a useful desktop layout. Respect reduced-motion settings and screen-reader labels.
- Profiles: display name, adult age, city/region, biography, relationship intention, optional cultural/language details and moderated photos. Keep birth date, email and precise location private. Use broad location rather than home addresses or live coordinates.
- Profile completion/editing, discovery preferences, pause visibility and account deletion. Exclude self, blocked/suspended/deleted accounts and previously handled profiles according to the agreed rediscovery rules.

### Accounts

- Email/password registration, email verification, login/logout and password reset.
- Google and Facebook OAuth, appropriate callback allowlists, safe account-linking/recovery and an admin MFA requirement. Social login is authentication, not identity or age verification.
- Configure a real transactional SMTP provider. Supabase's default mailer is restricted to project-team addresses and is unsuitable for general test invitations/password resets. [SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).
- Brevo is a candidate free mail provider with 300 sends/day. Verify sender approval, deliverability and suitability for dating-related transactional mail before relying on it. An existing authenticated sending domain is preferable; if none exists, verify an allowed sender path before promising zero email costs. [Brevo free plan](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan), [sender requirements](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication).
- Configure Facebook tester roles for the uncle during development. Public login depends on Meta's live-mode, permissions and any applicable review/verification requirements. Include privacy and deletion URLs. [Facebook integration](https://supabase.com/docs/guides/auth/social-sign-in/auth-facebook).

### Memberships — proposed defaults

| Capability | Free | Gold | Diamond |
| --- | --- | --- | --- |
| Discover profiles and create matches | Yes | Yes | Yes |
| Daily likes | 25 | 100 | 250 |
| See identities of incoming likes | No | Yes | Yes |
| Chat and audio/video after matching | Yes | Yes | Yes |
| Undo last pass | No | Yes | Yes |
| Advanced discovery filters | No | No | Yes |
| Hide profile from discovery except people liked | No | No | Yes |

These are product proposals, not supplied requirements; daily limits and optional perks can change without changing the architecture. Blocking, reporting, deletion and safety settings remain available to every tier. Sensitive filters require a privacy/legal assessment.

Before matching, Free members receive only an optional aggregate incoming-like count. Do not send liker identities, photos or revealing metadata and blur them in CSS. Mutual matches remain visible to both users. Entitlements and expiry are checked in the backend for every restricted action.

Implement PayPal Subscriptions sandbox checkout and Stripe sandbox Checkout/Billing for credit/debit cards in the test release. Keep an administrator-only tier override as a separate, audited testing tool; it must not substitute for a real sandbox payment integration or count as payment revenue. Real recurring payments are a later launch step with provider approval, verified/idempotent webhooks, cancellation, refunds and accurate renewal disclosures. Payment fees are outside free hosting. A checkout redirect must never grant an entitlement by itself. See [payments and administration](payments-and-admin.md) for state handling and acceptance criteria. Stripe currently classifies online dating/matchmaking as restricted, so live acceptance is an explicit dependency. [Stripe restrictions](https://stripe.com/gb/legal/restricted-businesses), [Stripe sandbox testing](https://docs.stripe.com/billing/testing), [PayPal sandbox testing](https://developer.paypal.com/subscriptions/test-go-live).

### Administration portal

Provide a responsive `/admin` portal with an intuitive sidebar: Overview, Users, Memberships, Payments, Reports, Moderation and Settings. Include date-range graphs, new-user and activity statistics, aggregate traffic, Free/Gold/Diamond counts, premium conversion, subscription lifecycle and payment/refund history. Separate sandbox amounts and manually assigned memberships from actual paid revenue. Use definitions, period/timezone labels, accessible tables and CSV exports. Build charts on indexed aggregates rather than scanning all events on every visit.

Add user search/filtering, account status, profile/photo review, suspend/restore, report handling, membership support and audited privileged actions. Separate owner, moderation, billing and analyst permissions, enforced server-side with MFA. Operational visibility must not become unrestricted private-message access or expose authentication secrets/card details. Access to reported message evidence needs a specific moderation workflow and audit trail. See [administration specification](payments-and-admin.md).

### Matches, chat and calls

- A reciprocal like creates exactly one match inside a transaction. Handle simultaneous likes and retries with unique constraints and stable client request identifiers.
- Durable text messages with paginated history; realtime only for authorized active conversations. Support delivery state, unread counts, unmatch, block and report. Blocking/unmatching prevents new sends and call setup on the server and removes active channel access as supported.
- One-to-one browser audio/video using WebRTC, with authenticated signaling through private Realtime channels. Validate match membership before signaling and issuing short-lived TURN credentials. Implement incoming-call acceptance, mute, camera toggle, hangup, busy/declined states, permission errors and connection recovery.
- Use Cloudflare Realtime TURN for difficult networks. Current shared SFU/TURN allowance is 1,000 GB of egress per month, with paid overages. Check account activation/billing requirements and enforce pilot limits before enabling it. If a guaranteed no-charge configuration cannot be established, retain that as an explicit deployment dependency or evaluate coturn on the free Oracle VM within its network quota. [Realtime pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/).
- Prefer relay-only calling for peer IP privacy, accepting higher relay bandwidth. Do not record calls. Start with calls while the app is open; background mobile incoming calls have browser limitations and need separate product work.
- Do not describe chat as end-to-end encrypted unless a separately designed implementation supports that claim. Standard transport/storage encryption and authorized moderation are the initial model.

## 5. Data design, security and scaling

Initial tables: private accounts, discoverable profiles, photos, preferences, swipe actions, matches, messages, blocks, reports, memberships, entitlements, consent events, call sessions, admin roles, moderation audit events, subscriptions, payment transactions, processed webhook events and aggregate analytics. Payment rows carry a provider and sandbox/live environment. Keep manual entitlements distinct from payment-derived access.

Use Row Level Security and storage policies with separate private and discoverable data. A profile's public projection must not expose its birth date or contact information. Restrict likes, reports, conversations and moderation data by actor and purpose. Service-role keys stay in server secrets. Audit security-definer functions, their search paths and grants; do not assume they inherit user policies.

Index discovery filters, reciprocal-like lookups, normalized match pairs and `(match_id, created_at, id)` for chat pagination. Prevent duplicate swipe/match records. Use keyset pagination instead of loading the full member list, and avoid random full-table sorts. Cache public assets and configuration, not personal discovery responses in shared caches. Persist messages in PostgreSQL and treat realtime events as updates that clients can recover after reconnecting.

Add authenticated rate limits for likes, messages, reports, calls, login and uploads; validate inputs server-side and mitigate bots. Protect admin actions with roles, MFA and an audit trail. Add security headers, dependency checks and redacted logs. Default message notifications should not expose sensitive content on a lock screen.

Scale after measuring representative discovery, message and call traffic. Move to paid database capacity, durable backups and higher realtime quotas when needed; isolate media processing/background work as it grows. Calls consume separate relay capacity. A CDN and Docker do not eliminate the database bottleneck. Do not promise a user count from a monthly-active-user quota.

Initial performance targets, to be verified rather than promised: responsive gestures at 60 fps on representative phones; public-page LCP under 2.5 seconds at the 75th percentile; paginated discovery p95 under 500 ms in a defined UK-region pilot load test. Capture the test device, network, dataset and concurrency with the results.

## 6. UK privacy, consumer and safety work

Draft documents should describe the actual operator and data flows. They cannot guarantee that the owner avoids liability. Obtain UK legal review before public launch or paid memberships, and before collecting real sensitive profile data where the legal basis is unresolved.

Public documents to prepare: website Terms of Service/membership agreement, privacy notice, cookie/storage notice, community and acceptable-use rules, reporting/complaints and appeals procedure, safety/18+ policy, subscription/cancellation/refund terms and a clear contact/deletion route. EULA means End User Licence Agreement; assess whether any software-licence provisions are needed rather than adding an unrelated generic EULA to a browser service.

The implementation and operating process must also cover:

- **Lawful processing:** identify Article 6 bases and an Article 9 condition for sensitive information such as religion, ethnicity or sexual orientation. Where explicit consent is used, make it specific, recorded and withdrawable; do not bury it in acceptance of terms. Minimize optional fields and assess matching inferences. [ICO special-category guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/special-category-data).
- **Privacy assessment:** complete a DPIA before real-user release as the project standard, assess statutory triggers, document purposes/recipients/retention and review residual risks. [ICO DPIAs](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/when-do-we-need-to-do-a-dpia/).
- **Rights and security operations:** access/export, correction, withdrawal, deletion, retention schedules and justified exceptions for reports/abuse evidence; a breach response and notification assessment; processor agreements, subprocessor inventory and appropriate international-transfer safeguards. Selecting London alone does not resolve transfers. [ICO transfers](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-guide-to-international-transfers/).
- **Cookies and marketing:** document required session storage; initially omit advertising and optional tracking. Assess any later technologies against current PECR exemptions/consent rules and separate marketing preferences. [ICO updated guidance announcement](https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/04/final-storage-and-access-technologies-guidance-published/).
- **Online safety:** assess Online Safety Act scope; complete illegal-content and children's-access assessments where applicable, then any children's-risk assessment required by the result. Provide functioning reporting, complaints, moderation and appeals with a responsible human operator. Assess age assurance rather than treating a date-of-birth checkbox or 18+ terms as sufficient. Prohibit pornography and assess how uploads, messages and live calls affect risk. If applicable, highly effective age assurance is required. [Ofcom dating-service guidance](https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/dating-and-social-discovery-know-the-online-safety-risks-rules-and-how-to-comply).
- **Operator and charges:** establish the controller/business identity, contact details, launch territories and whether an ICO data protection fee is payable. Free hosting does not remove business compliance costs. [Government fee guidance](https://www.gov.uk/data-protection-register-notify-ico-personal-data).
- **Subscriptions:** review current consumer rights and commencement of the new subscription regime when payments launch. Implement clear price/renewal information, accessible online cancellation and applicable cooling-off/refund handling. [Government subscription guidance](https://www.gov.uk/government/publications/subscription-contracts).

Pakistani/Indian styling is not equivalent to launching legally in Pakistan and India. Review local privacy, platform, consumer, payment and cross-border requirements before targeting residents there; assess EU rules if targeting EU residents.

## 7. Delivery sequence and acceptance

1. **Foundation:** settle initial branding/positioning, data minimization and architecture; use the owner-created GitHub repository at https://github.com/syedumairumar/findmymehram, commit the plan/source and use feature branches/pull requests. It is currently public; preserve the owner's selected audience. Create owner-controlled cloud projects, a Docker-backed local Supabase environment with fictional seed data, separate local/test configuration, schema migrations, secrets and a deployment pipeline. Deliver a skeleton HTTPS test URL and a verified local startup workflow.
2. **Accounts and profiles:** implement email and social sign-in, recovery, profile/photos, consent capture and discovery. Deliver responsive landing and onboarding with fictional test data.
3. **Matching and memberships:** implement swipes, atomic matches, entitlement checks, incoming likes, PayPal and card sandbox subscriptions, plus separate administrator tier overrides. Verify keyboard/mouse/touch behaviour, renewals, failures, cancellation and tier expiry.
4. **Communication and safety:** implement durable chat, calls, private channels, TURN, block/report/unmatch and the moderation dashboard. Verify across networks and browser permissions.
5. **Administration, privacy and QA:** finish the full dashboard and reports, policy drafts, export/deletion workflows, retention configuration, rate limits, backup restoration, accessibility and representative performance/security checks. Record legal/operational items still pending.
6. **Private handover:** deploy the finished test release, invite the uncle, provide two or more adult test accounts plus separate tier roles, the GitHub URL, verified local setup and deployment/rollback documentation, an admin guide, payment sandbox instructions and a short issue list. Prove that a local edit can pass checks, deploy and be rolled back. Do not send account passwords or privileged secrets in a public repository or URL.
7. **Public-launch preparation:** finalize operator information, legal/safety assessments, real-user policies, any age-assurance integration, payment-provider approval and an operating budget. This follows the test handover.

Essential acceptance checks:

- Register, verify, log in/out and reset a password through a delivered email; complete Google and Facebook tester flows with the intended accounts.
- Swipe with touch, mouse buttons and keyboard; recover cleanly from network errors and duplicate submissions.
- Create exactly one match from simultaneous reciprocal likes. Prevent blocked/suspended users from appearing or reconnecting through protected APIs.
- Inspect network responses as Free, Gold and Diamond users. Free accounts cannot recover incoming liker identities through direct queries, storage access, RPCs or realtime events; expiry removes premium access.
- Reject messages/signaling from unmatched users or unrelated accounts. A new block prevents subsequent messaging and calls.
- Test audio/video on two physical devices over separate networks, including forced TURN, permission denial and call termination. A localhost call alone is insufficient.
- Test policies, report handling, account export/deletion, administrative separation and an actual restore from backup.
- Test mobile Safari and Android Chrome, plus desktop browsers, keyboard navigation and responsive layouts. Document background-call limitations.
- Start from a fresh clone using the documented local workflow; apply migrations and seeds without touching hosted data. Local email previews must work. Document external dependencies for social login, hosted webhooks and browser calls.
- Complete both PayPal and card sandbox subscriptions, verify paid access and admin reporting, then exercise cancellation, failed renewal, duplicate/out-of-order webhooks and expiry. Forged events and checkout redirects must not grant access.
- Prove ordinary users cannot call admin APIs; verify roles, date-range charts, traffic-versus-signup metric definitions, CSV exports and sandbox/live separation.
- Deploy a reviewed commit using the documented release path, record its SHA, perform a smoke test and demonstrate application rollback without destructive database rollback.

## 9. Local development, GitHub and deployment documentation

The repo must include a root README, pinned runtime/package versions, a lockfile, `.env.example` with placeholders, ignore rules for secrets/generated files, migrations, fictional seeds and automated checks. Keep application, backend functions, schema and runbooks in the same repository. Do not commit real profiles, credentials or database backups.

Use local Supabase via Docker for database/auth/storage/realtime and local mail capture; run the React development server on the host for fast reload. Hosted preview deployments use an isolated test backend and sandbox payment credentials. Branch previews must not accidentally connect to live data. Social OAuth and genuine provider sandbox payments still require external services/internet access.

The required workflow is: fresh clone → dependency installation → local backend start → migrations/seed → frontend dev server → checks/build → feature branch/PR → preview URL → reviewed merge to main → hosted test release. Configure GitHub Actions and Cloudflare deployment so failed checks cannot release the app; database migrations and functions need explicit deployment steps as well as the frontend build. Use backward-compatible schema migrations and document rollback limitations.

Detailed runbooks: [local development](local-development.md), [deployment and rollback](deployment.md), [payments and admin](payments-and-admin.md). They currently specify the future implementation contract; executable app commands must be validated and their status updated once the app exists.

## 8. External prerequisites and cost boundary

Cloud resources, OAuth apps and email sender identities should belong to the owner/uncle, with the minimum access needed for deployment. Account signup, identity/card verification, Meta approvals, DNS ownership and legal/business decisions may require the owner. Configure credentials in provider secret settings; do not share passwords in chat.

No existing cloud accounts or deployment credentials have been supplied or inspected in this planning task. A successful future handover requires an actually reachable HTTPS URL; a local screenshot or frontend-only mock is not completion of the full application.

Target: zero hosting spend for the invited pilot where the chosen accounts and quotas permit it. Domains, legal review, registration fees, payment processing, reliable production backups/moderation, identity/age checks and usage beyond free quotas may cost money. If any required provider cannot be enabled without billing exposure, resolve that explicitly rather than describing the whole service as guaranteed free forever.
