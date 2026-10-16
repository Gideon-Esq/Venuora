# Gmail API delivery for Venuora

Booking emails and sign-in links share `src/lib/email.ts`. Gmail API is selected when any Gmail OAuth setting is present; incomplete settings produce an error. With no Gmail credentials, the existing Resend or development-console fallback remains available. SMTP settings are no longer used. Nodemailer only builds the MIME message in memory; sending uses Google's HTTPS API.

## Create the Google credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/), select or create a project and enable **Gmail API** in APIs & Services.
2. Configure the Google Auth Platform consent screen. For an external app in Testing, add the sending Google account as a test user. This authorizes Venuora's sending mailbox, not every venue owner's Gmail account.
3. Create an OAuth client of type **Web application**. Add `https://developers.google.com/oauthplayground` as an authorized redirect URI. Save the client ID and secret privately.
4. Open [OAuth Playground](https://developers.google.com/oauthplayground/). In settings, select **Use your own OAuth credentials**, enter that client ID and secret, and use offline access with consent prompting.
5. Request only `https://www.googleapis.com/auth/gmail.send`. Authorize the Gmail or Workspace account that should send Venuora emails.
6. Exchange the authorization code for tokens. Save the **refresh token**, not the short-lived access token.

## Configure the application

Fill these server-only entries in local `.env`, and in Vercel environment variables for your deployed app:

```dotenv
GMAIL_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GMAIL_CLIENT_SECRET="your-client-secret"
GMAIL_REFRESH_TOKEN="your-refresh-token"
EMAIL_FROM="Venuora <your-sending-account@gmail.com>"
```

The From address must be the authorized account or an approved send-as alias. No Google account password or app password is used. Keep OAuth secrets out of chat, source control and `NEXT_PUBLIC_` variables. Restart locally and redeploy on Vercel after changing them.

An external OAuth app in Testing generally receives refresh tokens that expire after seven days for this scope. Configure the appropriate production publishing/verification state for reliable ongoing delivery; Workspace administrators may impose additional policies. These are Google account configuration steps, not application code changes.

The app exchanges the refresh token for an access token, caches it until shortly before expiry, and sends a base64url MIME message through `users/me/messages/send`. A rejected access token triggers one refresh/retry. Other send failures are not automatically retried, to avoid accidental duplicate messages. Gmail API permissions, sending limits, and account policies still apply.

## Verify

```bash
npx vitest run --config vitest.email.config.ts
npx tsc --noEmit
```

Tests use mocked Google responses; no email is sent. After credentials are configured, deliberately request a sign-in email to test real delivery. The existing sign-in provider ID remains `resend` internally for compatibility; its callback uses the shared Gmail API delivery function.

References: [Gmail sending guide](https://developers.google.com/workspace/gmail/api/guides/sending), [Google OAuth](https://developers.google.com/identity/protocols/oauth2/), [OAuth Playground](https://developers.google.com/oauthplayground/).
