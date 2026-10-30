# Find My Mehram

GitHub: https://github.com/syedumairumar/findmymehram

An adults-only Pakistani/Indian dating and relationship web app, planned for mobile and desktop with profiles, matching, memberships, chat and audio/video calls.

## Current status

The first application milestone is implemented: responsive landing/discovery, a labelled fictional demo, matching, persistent demo conversations, membership previews, profile editing, an admin dashboard, and a Supabase backend for real test accounts, matching, chat and TOTP two-factor authentication.

The core backend has passed 16 direct authorization checks, including real authenticator verification. Audio/video calling, genuine provider sandbox checkout/webhooks, OAuth configuration, hosted transactional email and final launch policies remain outstanding. Their controls do not pretend to perform real calls or payments.

## Run locally

Use Node 24 (`nvm install && nvm use`). For the fictional browser-local preview:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173 and select **Explore the demo**. With no `.env.local`, no backend account is required.

For real local test accounts, start Docker, then:

```sh
npm run backend:start
npm run backend:env
npm run backend:seed
npm run dev
```

Local fixture credentials are generated in the ignored `.local-test-accounts.json` file. The Omar fixture has an owner role; the admin portal still requires genuine authenticator enrollment and verification. Email verification/reset messages appear at http://127.0.0.1:54324.

```sh
npm run typecheck
npm test
npm run backend:test
npm run build
```

See the local guide for Docker compatibility and service limitations. Never deploy fixture credentials.

## Required stack and features

- React/TypeScript/Vite frontend on Cloudflare Pages with CDN assets.
- Supabase PostgreSQL, Auth, private Storage, Realtime and server functions.
- Local Supabase via Docker and fictional seed data.
- Free, Gold and Diamond memberships with server-side enforcement.
- PayPal and credit/debit-card subscriptions using genuine provider sandboxes.
- Role-protected admin dashboard, user management, analytics, subscriptions/payments and moderation.
- Documented local setup, preview/release deployment, database migrations and rollback.

## Documentation

- [Implementation and hosting plan](docs/implementation-plan.md)
- [Local development](docs/local-development.md)
- [Deployment and rollback](docs/deployment.md)
- [Payments and administration specification](docs/payments-and-admin.md)
- [Security design and release gates](docs/security.md)

Initial testing uses invited adult testers, fictional profiles and sandbox payments. The target is zero hosting spend within free quotas; no public launch, live payment approval or unlimited free capacity is implied.
