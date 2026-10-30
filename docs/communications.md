# Chat and calls

Chat uses durable PostgreSQL messages and authorized Realtime notifications. A mutual active match is required; blocks and suspensions revoke access on the server. Chat is not end-to-end encrypted. The current UI loads the latest 50 messages; older-message pagination is still required.

## Calling implementation status

The call screen, relay-only WebRTC client, database authorization and `call-relay` Edge Function are implemented in source. **Real media has not been verified on two devices and calling remains disabled on the hosted preview.** Applying a migration is not a successful call test.

Migration `202610300002` adds calls, transient signaling, per-operation authorization, rate limits and automatic retention. Only the match's other participant can accept. Media negotiation starts after acceptance. Blocking revokes subsequent signaling and its reads; the supported clients stop media when the server revokes call access. Either participant can hang up after a block.

WebRTC uses `iceTransportPolicy: "relay"` with ephemeral Cloudflare TURN credentials. The application does not offer direct peer networking or a public STUN fallback. No call media is recorded or stored by the app. Master TURN credentials are server-only; each participant gets one credential grant per accepted call, expiring after 660 seconds. Test calls expire after ten minutes. This is an application limit, not a provider-enforced spending cap or prevention of credential reuse during its short lifetime.

Invitations are limited to ten per member per hour and one active call per participant. Calls ring for 45 seconds. Signals are removed on hang-up, or by a ten-minute cron after expiry; call metadata expires after one day. Database backups and provider metadata have separate retention requirements. Realtime events trigger fresh authorized reads; a polling fallback handles lost events. Production scale requires load testing, quota monitoring and further optimization.

## Configure the test service

1. Apply `202610300002_call_authorization.sql` to the exact test project, after checking migration history. Ensure `pg_cron` and the `findmymehram-call-retention` job are active.
2. Deploy `call-relay` to that project. Configure `APP_ORIGINS` with exact allowed frontend origins. Keep `CALLS_ENABLED=false` while preparing credentials.
3. Create a Cloudflare TURN key in the owner's account. Set `CLOUDFLARE_TURN_KEY_ID` and `CLOUDFLARE_TURN_API_TOKEN` in Supabase's server secret store. Do not put them in `VITE_*` variables, Git or chat.
4. Verify current free quota, billing controls and alerting before activation. Cloudflare currently documents a 1,000 GB free tier followed by usage charges; this is not unlimited free hosting. Do not enable paid plans or accept overages as part of a zero-cost test without the owner's specific approval. Keep the pilot invitation-only and monitor usage. [Cloudflare TURN pricing FAQ](https://developers.cloudflare.com/realtime/turn/faq/).
5. Set server `CALLS_ENABLED=true` and frontend `VITE_CALLS_ENABLED=true` only for the configured test environment. Redeploy the frontend. Both settings must be enabled.
6. Test with two invited adults on separate browsers/devices and networks. Each tester grants their own microphone/camera permission directly. Test audio/video, decline/no answer, mute/camera controls, autoplay restrictions, denied permissions, network interruption, hang-up, expiry, blocking and suspension. Confirm tracks stop and the browser's recording indicator clears.
7. Confirm an unrelated account cannot read call/signaling records or obtain relay credentials. Verify retention and quota usage. Keep the integration labelled unverified until the real media tests pass.

Local database checks run through `npm run backend:test` and include call authorization. `npm run functions:check` checks all server entry points with pinned Deno. The local Edge runtime remains an optional service requiring a healthy compatible image; the core local backend does not start it automatically.

Provider references: [TURN credential generation](https://developers.cloudflare.com/realtime/turn/generate-credentials/), [WebRTC configuration](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/RTCPeerConnection).
