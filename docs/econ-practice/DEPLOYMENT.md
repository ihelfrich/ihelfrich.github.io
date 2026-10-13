# Economics practice deployment

Working checkout: `/Users/ian/Developer/agent-playground/economics-practice`, branch `codex/adaptive-economics`. Nothing in this document establishes a production deployment. The response service uses Cloudflare Workers and D1; the static site uses the existing GitHub Pages workflow.

## Account setup

From the checkout, run `npx wrangler login` and complete Cloudflare's login in the local browser. Verify with `npx wrangler whoami`. Do not copy authentication tokens into a chat or commit them. The October 13 preflight found Wrangler unauthenticated.

In [Google Auth Platform](https://console.cloud.google.com/auth/clients), use an existing appropriate project or create one, configure its branding/audience, and create an OAuth client of type **Web application**. Add these authorized JavaScript origins:

- `https://ihelfrich.github.io`
- `http://localhost:4321`

Use `localhost:4321` for Google testing; the anonymous browser checks on `127.0.0.1:4321` do not establish an authorized Google origin. This implementation uses the Google Identity Services JavaScript callback, so it needs the public client ID and no client secret or application redirect handler. Keep the client secret out of the checkout and chat. If the Google app remains in testing, ensure the intended test accounts can use it. See [Google's setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

Set `GOOGLE_CLIENT_ID` to that public ID in the Worker's `vars` in `services/econ-response/wrangler.jsonc`. For the local Node service, set the same environment variable before running `node services/econ-response/dev.mjs`. Do not enable `ALLOW_BOOTSTRAP_ADMIN` in production.

## Provision the database

After account selection, run these commands from the checkout:

```sh
npx wrangler d1 create helfrich-economics-responses --config services/econ-response/wrangler.jsonc
```

Replace the all-zero `database_id` in that config with the returned actual D1 ID. Retain binding name `DB`, database name, and `migrations_dir`. If the named database already exists, inspect it and use its ID instead of creating a duplicate. Then apply and verify migrations against the intended remote database:

```sh
npx wrangler d1 migrations apply helfrich-economics-responses --remote --config services/econ-response/wrangler.jsonc
npx wrangler d1 migrations list helfrich-economics-responses --remote --config services/econ-response/wrangler.jsonc
```

All repository migrations are required, including stopping policy, scoped-history indexes, and policy immutability. Filename numbering has an intentional gap at 0012. These commands are described in [Cloudflare's D1 command reference](https://developers.cloudflare.com/d1/wrangler-commands/). Do not upload the local synthetic SQLite database.

## Instructor identity

Instructor authorization uses `INSTRUCTOR_SUBJECT_HASHES`, a comma-separated allowlist of verified Google subject hashes. Email text alone never grants instructor access. First complete a real Google sign-in against the configured local service. Confirm the intended account on the screen, then inspect only that newly verified account's `identity_subject_hash` in the local database. The server computed it from `SHA-256("https://accounts.google.com:" + verified_sub)` after validating Google's signature, audience, issuer, nonce and verified email. Do not derive it from a guessed email or an unverified decoded JWT.

Set the verified allowlist through Cloudflare's local interactive prompt:

```sh
npx wrangler secret put INSTRUCTOR_SUBJECT_HASHES --config services/econ-response/wrangler.jsonc
```

Keep the allowlist private and out of browser code. A local instructor test additionally needs that value in the Node service environment. Never paste a Google ID token or API credential into a chat. A successful local verified login is still not a production end-to-end test.

## Release gate

Before publishing, rerun `npm run check`, review the diff/commit, and run:

```sh
npx wrangler deploy --dry-run --outdir .local/econ-response/deploy-preview --config services/econ-response/wrangler.jsonc
```

The October 13 dry run succeeded with a placeholder database; a bundle success does not verify runtime startup, remote bindings, migrations, Google login, or permissions. A subsequent Wrangler local-runtime check caught an invalid named constant export, which was removed. All 13 migrations and a synthetic assessment now pass in local workerd/D1. The site deployment workflow includes this runtime regression gate; its result still does not prove remote operation. To repeat locally with an isolated database, run:

```sh
npx wrangler d1 migrations apply helfrich-economics-responses --local --persist-to .local/econ-response/wrangler-verification --config services/econ-response/wrangler.jsonc
npx wrangler dev --local --port 8788 --persist-to .local/econ-response/wrangler-verification --config services/econ-response/wrangler.jsonc
```

In another terminal in the checkout, run `node scripts/econ-practice/verify-local-worker.mjs`. It creates synthetic records only at the hardcoded loopback port 8788. Stop that local Wrangler process after checking. Confirm the real database ID, Google client ID, production `ALLOWED_ORIGINS` (`https://ihelfrich.github.io`), and instructor allowlist before requesting final publishing approval.

After Dr. Helfrich approves the concrete release, deploy the Worker:

```sh
npx wrangler deploy --config services/econ-response/wrangler.jsonc
```

Use the returned HTTPS Worker origin as the GitHub repository Actions **variable** `PUBLIC_ECON_API_URL` for `ihelfrich/ihelfrich.github.io`. It is a public URL, not a secret. The existing `.github/workflows/deploy.yml` passes it to the Astro build. Publishing or merging the site branch is a separate approved release action; creating a Worker does not publish the frontend.

Verify `/health`, then through the published browser UI verify anonymous consent/session/answer/receipt/reload, Google login, optional linking, sign-out and reauthentication, instructor-only access, an assigned synthetic assessment, report/ledger export and the exact D1 stored receipt. Check an unauthorized account cannot access instructor routes or another participant's session. Mark synthetic evidence explicitly and keep it out of calibration. Never activate a synthetic calibration to make a demo look calibrated.

## Interpretation and remaining limits

The bank remains author-seeded until an empirically supported model is approved and released. Self-directed diagnostics pin a unit-wise policy: at least 18 eligible responses overall, at least six eligible distinct families in each required unit, posterior SD at most 0.35 and boundary mass below 0.01 in every unit, with the existing maximum of 36 questions. All required units must have calibrated evidence. Six units require at least 36 eligible responses, so a six-unit diagnostic cannot finish early under this policy. Fixed assignments stay fixed unless their author selects unit-wise precision; their chosen count is then the maximum. These thresholds are operational choices, not validated mastery standards.

Reports replay only their session; selection replays the selected course's history. The immutable ledger is never truncated. Within-course lifetime replay still grows; deployment load testing and a verified checkpoint scheme remain future scaling work. Browser checks cover the in-app Chromium surface; Safari, Firefox, a screen reader, and live Google/Cloudflare flows remain unverified. Do not describe this as universally accessible or production-validated.
