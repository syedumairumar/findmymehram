# Payments and administration

Status: the first admin UI and backend authorization are implemented. The real portal requires a server-granted role and verified TOTP; its fictional demo uses labelled sample data. Current tables are bounded to 100 rows and aggregate daily active/traffic metrics are not connected. Genuine provider checkout, subscription lifecycle/webhooks and advanced reporting below remain implementation requirements.

## Payment methods and products

Use PayPal Subscriptions in its sandbox for PayPal-wallet recurring subscriptions. Use Stripe sandbox Checkout/Billing for a clear credit/debit-card checkout that does not require the tester to have a PayPal account. Do not assume PayPal guest card subscriptions are universally available; eligibility and funding methods vary. A provider abstraction should keep internal tiers independent of provider identifiers.

Create monthly Gold and Diamond sandbox products/prices in GBP, with obvious test labels and editable configuration. Select nominal sandbox prices before implementation; they are not final live pricing. Free membership never requires checkout. Annual billing is outside the initial scope unless separately requested.

Provider-hosted payment components collect payment details. The application must not receive/store raw card numbers or CVV. Show only the minimal provider references/payment status needed for support. Use provider-issued test cards and PayPal sandbox buyer accounts; never ask testers to enter a real card into the test release.

References: [Stripe subscription testing](https://docs.stripe.com/billing/testing), [PayPal subscription testing](https://developer.paypal.com/subscriptions/test-go-live).

## Subscription state and security

- Authenticate the buyer and determine the approved tier/price server-side; do not trust browser-supplied amounts, account IDs or entitlement claims.
- Create provider subscriptions with idempotency where supported and associate them with the correct internal account. Prevent accidental duplicate active subscriptions across providers.
- Accept signed/authenticated provider webhooks, validate their sandbox/live environment and reconcile the relevant payment/subscription object. Use a unique `(provider, environment, event_id)` constraint so retries cannot double-apply a payment.
- Store a durable event-processing record and retry failures. Cope with delayed and out-of-order events by reconciling current provider state rather than trusting delivery order. A success URL, client callback or subscription-created event alone does not establish that a payment settled.
- Derive entitlements from verified provider status, paid-through dates and an explicit failed-payment grace policy. A scheduled cancellation preserves access only through the paid period; immediate revocation/refund rules must be defined and tested.
- Support renewal, declined/failed payments, authentication-required cards, cancellation, expiry, refund and dispute states. Changes between tiers should follow a documented policy; for the first version, schedule plan/provider changes at period end instead of implementing ambiguous proration.
- Permit an audited owner-only test entitlement override with an expiry and reason. Mark its source as manual; it must not create a fake transaction or revenue amount.
- Provide an account Billing screen with plan, next charge/expiry, payment provider and cancellation controls. Refund/cancellation requests in the admin portal must use server-side provider calls and show the resulting verified state.

## Admin experience

Use the same design system as the member app, with desktop sidebar navigation, a responsive mobile menu, readable tables, clear empty/loading/error states and useful search/filter controls. Charts can use Recharts with accessible tabular alternatives.

| Page | Required capabilities |
| --- | --- |
| Overview | Total members, new registrations, active users, tier distribution, signup/activity trends, premium conversion, open reports and payment summary |
| Users | Search by permitted identifiers, filter tier/status/date, inspect profile/account status, suspend/restore, pause discovery and initiate documented support/deletion workflows |
| Memberships | Free/Gold/Diamond, provider, payment-derived versus manual access, renewal/expiry, cancellation and failed-payment state |
| Payments | Provider transaction references, amount/currency, status, refunds, subscription link and reconciliation errors; explicit sandbox labels |
| Reports | Date-range signup/activity/traffic charts and operational exports; metric definitions and period-over-period comparison |
| Moderation | Report queue, evidence scoped to the report, action/reason, appeals and audit history |
| Settings | Product configuration, limits, administrator roles and integration health; secrets remain in provider secret stores |

### Metrics and efficiency

Define new users as completed registrations; active users as unique authenticated users performing defined activity in a day/week/month. Keep visitors/page views distinct from accounts and authenticated activity. Show date ranges and the selected timezone; store timestamps in UTC.

Collect aggregate public-page traffic without query strings, profile identifiers or message content. Evaluate a privacy-conscious traffic source and applicable consent requirements before enabling it. If analytics access/integration is unavailable, show an explicit unavailable state instead of fabricated data. Do not claim cookie-free collection automatically removes all privacy obligations.

Maintain daily indexed aggregates and bounded date queries. Paginate user/payment tables on the server. Cache permitted aggregate reports briefly and redact logs. Do not recalculate the dashboard by downloading the whole user base to the browser.

Report premium conversion, active subscriptions, collected payments and monthly recurring revenue as distinct metrics. Define how refunds, cancelled-but-still-entitled subscriptions and discounts affect each metric. Keep sandbox/live, currencies and manually granted access separate. No real revenue graph may include sandbox money.

### Authorization and accountability

Define owner, moderator, billing-support and analyst roles. Require MFA and backend checks for privileged access; hiding the `/admin` link is insufficient. Only the owner can grant roles or configure test entitlement overrides. Test that ordinary members cannot invoke privileged APIs directly.

The portal offers comprehensive operational visibility appropriate to each role. It must not provide casual browsing of all private chats, passwords, access tokens or call media. Reported-content access needs a lawful purpose, minimal evidence and an audit event. Calls are not recorded. Audit sensitive reads/exports and changes with actor, time, target, reason and outcome; restrict and retain those logs appropriately.

## Acceptance tests

1. Buy Gold and Diamond through each actual provider sandbox and confirm entitlement, billing page and admin membership/payment records agree.
2. Exercise successful renewal, card decline/authentication, PayPal cancellation, expiry/refund and period-end plan change as supported by the provider sandbox. Distinguish simulated webhook cases from full transactions.
3. Verify duplicate, delayed, out-of-order, forged and wrong-environment webhook behaviour. Failed reconciliation must be observable and retryable.
4. Confirm no paid access can be obtained by editing a return URL, client price or request body. Confirm no duplicate subscriptions are accidentally created across payment providers.
5. Verify a manual override is audited, expires and never counts as payment revenue. Confirm sandbox totals never enter live metrics.
6. Compare dashboard aggregates against known fictional records; test empty states, date boundaries, pagination and role-scoped exports. Verify CSV exports cannot turn user content into spreadsheet formulas.
7. Verify admin roles, MFA and direct API access boundaries, including reported-content evidence and audit logs.

## Live-payment dependency

Stripe lists online dating/matchmaking as a restricted category and jurisdiction-specific restrictions may apply. Obtain the actual merchant provider's approval for the business and target markets before enabling live payments. PayPal also requires account eligibility, live onboarding and applicable policy compliance. Successful sandbox payments do not establish live eligibility. [Stripe restricted businesses](https://stripe.com/gb/legal/restricted-businesses).

Use separate live credentials, products/plans, callback URLs and webhook verification settings; verify the complete transition using the deployment runbook. Never silently switch the publicly shared test URL into charging real money.
