# Authentication, email and social sign-in

## Current state

The app contains email/password registration, verified-email login, password recovery, Google and Facebook OAuth calls, and a password-update route. Local Supabase email is captured by Inbucket. Branded confirmation and recovery templates are in `supabase/templates/`.

The hosted Supabase project has email confirmation enabled, public registration disabled, manual identity linking disabled, and Google and Facebook provider credentials configured. Custom SMTP settings have been saved through Brevo with a test sender address. Brevo sender/phone verification and actual delivery have not been confirmed, so hosted confirmation and password-reset email are not yet verified. Keep password-reset UI disabled until delivery is checked. The Pages deployment has not yet been updated with the current OAuth-enabled source and build flags.

New OAuth users are directed to profile setup. The first profile save now requires an 18+ attestation and acceptance of the test Terms/Privacy Notice in the UI and database. Apply migration `202610300005_oauth_signup_consent.sql` to the hosted test project before allowing OAuth-created users to complete profiles.

## Exact URLs

The Supabase Auth provider callback is different from the app page users return to:

| Use | URL |
| --- | --- |
| Hosted Google/Facebook provider callback | `https://nyhohhdleovhbxwafxpn.supabase.co/auth/v1/callback` |
| Local Google/Facebook provider callback | `http://localhost:54321/auth/v1/callback` |
| Hosted OAuth/email confirmation return | `https://findmymehram.pages.dev/profile` |
| Hosted password recovery return | `https://findmymehram.pages.dev/auth?mode=update` |
| Local OAuth/email confirmation return | `http://127.0.0.1:5173/profile` |
| Local password recovery return | `http://127.0.0.1:5173/auth?mode=update` |

Add the hosted app return URLs to Supabase Auth's exact redirect allowlist. Add the Supabase callback URL (not the Pages URL) to each provider application. Google and Meta accept the local callback too when local OAuth is needed.

## Google

1. The Google Web application OAuth client has been created in the owner's Google Cloud project. Keep consent in testing and add only intended adult testers until the service is ready for public use.
2. Add the hosted Supabase callback above as an authorized redirect URI. Add the local callback only for local testing.
3. Supabase → Authentication → Sign In / Providers → Google is enabled and contains the client ID and client secret. Keep the secret only in Supabase's protected provider settings, never Pages variables or Git.
4. After a successful provider sign-in, the app returns to `/profile`. New accounts must complete adult/terms onboarding before member data is available.

Google setup reference: [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

## Facebook

1. The Meta app `Find My Mehram Test` has been created in Development mode. The Croydon app was removed at the owner's direction to free a Meta app slot.
2. The hosted Supabase callback above is saved under Valid OAuth Redirect URIs with HTTPS and strict redirect matching. Only `public_profile` and the basic email permission are needed for this test login.
3. Add each intended tester to an appropriate Meta app role. People without a role cannot sign in while the app remains in Development mode. Public use requires completing Meta's business verification and App Review requirements, then moving the app to Live mode.
4. Supabase → Authentication → Sign In / Providers → Facebook is enabled and contains the App ID and secret. Store the secret only in Supabase's protected provider settings.
5. Meta's policy and data-deletion URLs point to the hosted draft policy pages. They identify themselves as test drafts and must be replaced with reviewed, complete legal documents before a public release or Meta review.

Facebook setup reference: [Supabase Facebook sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-facebook).

Manual account linking remains disabled. Supabase automatically links a provider identity to an existing account when both identities have the same verified email. Use a dedicated test account with a verified matching email, and confirm the provider returned that email. The app routes administrators who sign in through OAuth to the authenticator challenge; server-side admin checks still require AAL2. [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

## Verification and recovery email

1. Brevo's SMTP service is connected to Supabase Auth on port 587. This test currently uses a Gmail sender address because the owner has no custom domain. Brevo sender/phone verification and real delivery still need confirmation; Gmail does not give the app domain-aligned SPF/DKIM authentication. Consider these settings preparatory until a controlled inbox receives the expected messages.
2. The SMTP username, key, sender name and sender address are saved in Supabase Auth's protected SMTP settings. Keep the SMTP key only there and in a protected local secret store, never in Git or frontend build variables.
3. Copy `supabase/templates/confirmation.html` and `supabase/templates/recovery.html` into Supabase Auth's hosted Email Templates page with the matching subjects. The `{{ .ConfirmationURL }}` variable must remain intact.
4. Send confirmation and recovery messages to controlled test inboxes. Confirm the links return to the exact Pages URLs above, complete password replacement, and verify that unknown addresses receive the same generic success response.
5. Keep hosted `VITE_PASSWORD_RESET_ENABLED=false` until a controlled test inbox has received both confirmation and reset messages and the callback links have been checked. Keep email confirmation enabled.

Supabase's default email service has restrictive test delivery and rate limits; use a real SMTP service for invited testers. [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

The hosted SMTP settings are saved, but hosted confirmation/reset delivery is not yet verified. Local email previews remain available through Inbucket at `http://127.0.0.1:54324`.

## Registration controls

Keep Supabase's **Allow new users to sign up** disabled and `VITE_INVITE_ONLY=true` during this private test. Provider credentials are configured, but a new tester still needs an existing invited account or an explicitly authorized sign-up path, and each tester must be allowed by the provider's testing mode. Migration 005 is required before OAuth-created accounts can save their first profile. Set the frontend Google/Facebook flags only in the test deployment after updating the site; do not enable public registration until SMTP, tester access and adult-safety controls are ready.

OAuth authenticates an account; it does not verify a person's identity or age. The date-of-birth rule is an attestation and is not identity proof.
