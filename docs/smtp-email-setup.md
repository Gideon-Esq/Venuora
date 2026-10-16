# Nodemailer email setup

Booking emails and sign-in magic links share `src/lib/email.ts`.

Delivery priority:

1. A non-empty `SMTP_HOST` enables Nodemailer SMTP.
2. Otherwise, a real `RESEND_API_KEY` enables the existing Resend integration.
3. Otherwise, development messages and magic links print to the server console.

SMTP failures are reported; the application does not silently fall back to another provider. The Auth.js provider ID remains `resend` for compatibility with the existing sign-in action, even when its delivery callback uses SMTP.

## Configuration

Fill the SMTP entries in your local `.env` with credentials from your email provider:

```dotenv
SMTP_HOST="smtp.your-provider.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-smtp-username"
SMTP_PASSWORD="your-smtp-password"
EMAIL_FROM="Venuora <bookings@your-domain.com>"
```

Port 587 uses STARTTLS (`SMTP_SECURE=false`). For implicit TLS on port 465, use `SMTP_PORT=465` and `SMTP_SECURE=true`. The sender must be authorized by your provider. TLS certificate validation remains enabled. Credentials and sender are required when SMTP is enabled.

See [Nodemailer's SMTP documentation](https://nodemailer.com/smtp).

Restart `npm run dev` after editing `.env`. Add the same server-only variables to Vercel's project environment settings and redeploy for production. Never prefix these variables with `NEXT_PUBLIC_` or commit their values. Gmail commonly requires an app password for accounts with two-step verification; other providers issue SMTP-specific credentials. Provider-specific authentication requirements apply.

The app sends existing branded HTML and a text version when provided by the template. Venue reply-to addresses are preserved. No live email is sent as part of the automated tests. Real SMTP delivery is not verified until valid credentials are configured and you deliberately exercise a sign-in or booking flow.

## Gmail / Google Workspace

1. Enable 2-Step Verification on the sending Google account.
2. Create an app password at https://myaccount.google.com/apppasswords and name it Venuora. Some Workspace administrators restrict app passwords; if unavailable, ask your administrator for an approved SMTP setup.
3. Use the full Gmail / Workspace address for `SMTP_USER` and the app password for `SMTP_PASSWORD`. Use the same address in `EMAIL_FROM` (or an authorized send-as alias).

```dotenv
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-address@gmail.com"
SMTP_PASSWORD="your-google-app-password"
EMAIL_FROM="Venuora <your-address@gmail.com>"
```

Use the app password, not the normal Google account password. Keep it in `.env` and your server environment settings. See [Google's app password guidance](https://support.google.com/mail/answer/185833) and [Workspace SMTP settings](https://support.google.com/a/answer/176600).
