# Find My Mehram

GitHub: https://github.com/syedumairumar/findmymehram

An adults-only Pakistani/Indian dating and relationship web app, planned for mobile and desktop with profiles, matching, memberships, chat and audio/video calls.

## Current status

This repository currently contains planning documents only. The application, deployment pipeline, database and payment integrations have not been implemented. Local startup commands in the runbooks are the implementation contract, not a claim that the app can already run.

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
- [Local development contract](docs/local-development.md)
- [Deployment and rollback contract](docs/deployment.md)
- [Payments and administration specification](docs/payments-and-admin.md)

Initial testing uses invited adult testers, fictional profiles and sandbox payments. The target is zero hosting spend within free quotas; no public launch, live payment approval or unlimited free capacity is implied.
