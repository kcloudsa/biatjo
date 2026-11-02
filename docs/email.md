# Email delivery

This guide explains how the backend sends email (OTP codes, password resets, notifications), how to configure each provider, and how to deploy it on Railway.

## Which provider to use

| Provider | Needs a custom domain | Works on Railway Free/Hobby | Use it for |
| --- | --- | --- | --- |
| **Brevo** (HTTPS API) | No, a verified Gmail sender is enough | Yes | **Production** |
| Gmail SMTP | No | No, Railway blocks outbound SMTP | Local development |
| Resend (HTTPS API) | Yes, to email anyone except the account owner | Yes | Only once you own a domain |

## How the provider is chosen

The logic lives in `src/config/nodemailer.ts`. Sending happens in `src/emails/index.ts`.

1. If `EMAIL_PROVIDER` is set to `brevo`, `gmail` or `resend`, that provider is used.
   If its credentials are missing, email is **disabled** and the log says which variable is missing. It never silently falls back to another provider.
2. Otherwise the first configured provider wins: Brevo, then Gmail SMTP, then Resend.
3. If nothing is configured, every send fails with a "not configured" error.

At startup the log prints one of these lines:

```
Email delivery: brevo HTTP API.
Email delivery: Gmail SMTP ready (port 465).
EMAIL_PROVIDER=brevo is set but its credentials are missing (BREVO_API_KEY). Email sending is disabled until it is set.
No email provider configured. ...
```

## Environment variables

| Variable | Used by | Description |
| --- | --- | --- |
| `EMAIL_PROVIDER` | All | Optional. `brevo`, `gmail` or `resend` to force a provider. |
| `BREVO_API_KEY` | Brevo | API key from Brevo, starts with `xkeysib-`. |
| `EMAIL_FROM` | Brevo, Resend | Sender, for example `"Byatjo <ahemdelasmer@gmail.com>"`. Defaults to `Byatjo <EMAIL_USER>`. For Brevo it must be a verified sender. |
| `EMAIL_USER` | Gmail, default sender | Gmail address. |
| `EMAIL_PASS` | Gmail | 16-character Gmail App Password. Spaces are ignored. |
| `EMAIL_SMTP_PORT` | Gmail | Optional. `465` by default; use `587` if 465 is blocked. |
| `RESEND_API_KEY` | Resend | Only useful with a verified domain. |

Values pasted with surrounding quotes (common in hosting dashboards) are handled correctly.

## Setup: Brevo (production)

1. Create a free account at [brevo.com](https://www.brevo.com). The free plan allows 300 emails per day.
2. **Verify the sender.** Go to *Senders, Domains & Dedicated IPs* > *Senders*, add `ahemdelasmer@gmail.com`, and click the confirmation link Brevo emails to it.
3. **Create an API key.** Go to *SMTP & API* > *API Keys* and generate a key.
4. **Turn off IP blocking.** Open <https://app.brevo.com/security/authorised_ips> and deactivate blocking of unknown IP addresses.
   Railway's outgoing IP changes between deploys, so an allowlist breaks sooner or later. Without this step every send fails with `401 ... unrecognised IP address`.
5. Set the variables on Railway (next section) and redeploy.

You do **not** need the Brevo SDK (`sib-api-v3-sdk`) or Brevo's "Create a campaign" sample. Campaigns are for marketing lists. The app calls Brevo's transactional endpoint (`POST https://api.brevo.com/v3/smtp/email`) directly with `fetch`.

## Setup: Gmail SMTP (local development)

1. Turn on 2-Step Verification for the Google account.
2. Create an App Password at <https://myaccount.google.com/apppasswords>.
3. In `.env`:

   ```env
   EMAIL_USER=ahemdelasmer@gmail.com
   EMAIL_PASS="xxxx xxxx xxxx xxxx"
   ```

4. Leave `BREVO_API_KEY` empty locally if you want Gmail to be used. Brevo has priority when its key is set.

Gmail SMTP does not work on Railway Free/Hobby. The log shows `Gmail SMTP verification failed ... Connection timeout` (`ETIMEDOUT`, command `CONN`). Use Brevo there.

## Deploying on Railway

1. Copy `.env.railway` from the project root. It is gitignored because it contains secrets.
2. Fill in the values that cannot be localhost in production:
   - `BREVO_API_KEY`
   - `DB_URI` (a database Railway can reach)
   - `CALLBACK_URI` and `FRONTEND_URL` (your real backend and frontend URLs)
3. In Railway open the service > *Variables* > *Raw Editor*, paste the file, and save.
4. Redeploy and check the log for `Email delivery: brevo HTTP API.`

The email part of the Railway variables:

```env
EMAIL_PROVIDER=brevo
BREVO_API_KEY=xkeysib-...
EMAIL_USER=ahemdelasmer@gmail.com
EMAIL_FROM="Byatjo <ahemdelasmer@gmail.com>"
```

Do not set `PORT` on Railway; Railway provides it.

## Endpoints that send email

All routes are available under both `/auth` and `/api/auth`.

| Endpoint | Email sent | If sending fails |
| --- | --- | --- |
| `POST /auth/register` | Verification OTP | `503 EMAIL_DELIVERY_FAILED`. The account is still created; call `/auth/otp/register` to retry. |
| `POST /auth/otp/register` | Verification OTP | `503 EMAIL_DELIVERY_FAILED` |
| `POST /auth/otp/resend` | Verification OTP | `503 EMAIL_DELIVERY_FAILED` |
| `POST /auth/login` (unverified email) | New verification OTP, sent in the background | Login still returns `EMAIL_NOT_VERIFIED`; the failure is only logged. |
| `POST /auth/forgot-password` | Password reset OTP | `500 FORGOT_PASSWORD_ERROR` |
| `POST /auth/reset-password` | "Password changed" notice | `500`, although the password is already changed at that point |
| `POST /auth/password-reset/request` | Password reset link | `500 RESET_REQUEST_ERROR` |
| `POST /auth/password-reset/complete` | "Password changed" notice | `500`, although the password is already changed at that point |

OTP codes are 6 digits and expire after 10 minutes.

Quick test with Postman or curl:

```bash
curl -X POST https://<your-railway-app>/auth/otp/resend \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
```

A `200` response means the email was handed to the provider. The first emails sent from a gmail.com address through Brevo may land in spam.

## Troubleshooting

| Log or response | Cause | Fix |
| --- | --- | --- |
| `Gmail SMTP verification failed ... Connection timeout` | Host blocks SMTP (Railway Free/Hobby) | Use Brevo: set `BREVO_API_KEY` and `EMAIL_PROVIDER=brevo`. |
| `EMAIL_PROVIDER=brevo is set but its credentials are missing` | `BREVO_API_KEY` is empty | Add the key in Railway Variables and redeploy. |
| `Brevo API request failed (401): ... unrecognised IP address` | Brevo IP allowlist | Deactivate IP blocking at <https://app.brevo.com/security/authorised_ips>. |
| `Brevo API request failed (401): Key not found` | Wrong or deleted API key | Create a new key and update `BREVO_API_KEY`. |
| `Brevo API request failed (400)` mentioning the sender | `EMAIL_FROM` is not a verified sender | Verify it in Brevo *Senders*, or change `EMAIL_FROM`. |
| `Resend API request failed (403)` | Sender domain not verified in Resend | Use Brevo, or verify a domain you own in Resend. |
| `503 EMAIL_DELIVERY_FAILED` in the API response | Any of the above | Read the line starting with `Email send failed via ...` in the server log. |

## Security notes

- Keep API keys and the Gmail App Password in `.env` (local) and Railway Variables (production) only. Never put them in source code.
- `.env` and `.env.*` (except `.env.example`) are gitignored.
- If a key is ever committed or shared, revoke it in Brevo or Google and create a new one.
