# Authentication, email and social sign-in

## Current state

The app contains email/password registration, verified-email login, password recovery, Google and Facebook OAuth calls, and a password-update route. Local Supabase email is captured by Inbucket. Branded confirmation and recovery templates are in `supabase/templates/`.

The hosted Supabase project currently has email confirmation enabled, public registration disabled, Google and Facebook disabled, and no production SMTP sender configured. Its built-in mailer is not suitable for sending verification and recovery mail to ordinary testers. The Pages build keeps OAuth disabled until the Supabase providers are configured. The site remains invitation-only.

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

1. In the owner's Google Cloud project, create a Web application OAuth client. Keep consent in testing and add only intended adult testers until the service is ready for public use.
2. Add the hosted Supabase callback above as an authorized redirect URI. Add the local callback only for local testing.
3. In Supabase → Authentication → Sign In / Providers → Google, enable the provider and enter the client ID and client secret. Keep the secret only in Supabase's protected provider settings, never Pages variables or Git.
4. After a successful provider sign-in, the app returns to `/profile`. New accounts must complete adult/terms onboarding before member data is available.

Google setup reference: [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

## Facebook

1. In the owner's Meta Developer account, create the Facebook app and configure Facebook Login for Web.
2. Add the hosted Supabase callback above under Valid OAuth Redirect URIs. Add the local callback only for local testing. Request only `public_profile` and `email` for the test login.
3. Keep the Meta app in Development mode and add each tester to an appropriate app role. People without a role cannot sign in while the app remains in Development mode. Public use may require App Review and moving the app to Live mode.
4. In Supabase → Authentication → Sign In / Providers → Facebook, enable the provider and enter the App ID and secret. Store the secret only in Supabase's protected provider settings.
5. Set Meta's public privacy-policy and data-deletion instructions to owner-controlled, publicly accessible pages before requesting review. The test policy pages are drafts, not launch-ready legal documents.

Facebook setup reference: [Supabase Facebook sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-facebook).

Manual account linking remains disabled. Supabase automatically links a provider identity to an existing account when both identities have the same verified email. Use a dedicated test account with a verified matching email, and confirm the provider returned that email. The app routes administrators who sign in through OAuth to the authenticator challenge; server-side admin checks still require AAL2. [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

## Verification and recovery email

1. Choose an email sending service and a domain the owner controls. A pilot option is Brevo's free plan, which currently includes transactional emails and 300 sends per day; its free messages include Brevo branding. The domain still has to be owned and authenticated. [Brevo free-plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan), [domain authentication](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC).
2. Configure that provider's SMTP host, port, username, password, sender name and verified sender address in Supabase Auth's SMTP settings. Keep the SMTP password only in the Supabase secret/configuration UI.
3. Copy `supabase/templates/confirmation.html` and `supabase/templates/recovery.html` into Supabase Auth's hosted Email Templates page with the matching subjects. The `{{ .ConfirmationURL }}` variable must remain intact.
4. Send confirmation and recovery messages to controlled test inboxes. Confirm the links return to the exact Pages URLs above, complete password replacement, and verify that unknown addresses receive the same generic success response.
5. Set hosted `VITE_PASSWORD_RESET_ENABLED=true` only after sending and recovery have both been verified. Keep email confirmation enabled.

Supabase's default email service has restrictive test delivery and rate limits; use a real SMTP service for invited testers. [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

Without an owned sending domain and configured SMTP service, actual hosted confirmation/reset email cannot be completed. Local email previews remain available through Inbucket at `http://127.0.0.1:54324`.

## Registration controls

Keep Supabase's **Allow new users to sign up** disabled and `VITE_INVITE_ONLY=true` during this private test. Existing provider-linked invited accounts can sign in once provider apps are configured. New OAuth accounts require public sign-up to be enabled; before changing that setting, apply migration 005, complete SMTP setup, decide whether registration should be public, and review the adult-safety and legal launch requirements. Set `VITE_GOOGLE_AUTH_ENABLED=true` or `VITE_FACEBOOK_AUTH_ENABLED=true` only after its provider has been configured and the login flow is verified.

OAuth authenticates an account; it does not verify a person's identity or age. The date-of-birth rule is an attestation and is not identity proof.
