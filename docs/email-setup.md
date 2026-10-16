# Transactional email setup

The venue-branded templates are in `src/lib/email-templates.ts`. They use inline styles and presentation tables for email clients, escaped booking details, venue-local times, formatted money, and a plain URL below each action button.

Preview the six requested emails without sending anything:

```sh
node --import tsx scripts/preview-emails.ts
```

Open `docs/email-previews/index.html` locally. Preview data is fictional; production emails use the booking and venue records.

When ready to enable delivery, configure `RESEND_API_KEY`, `EMAIL_FROM` with a verified Resend sender, and the application's existing public base URL configuration. Until a real API key is configured, the existing mail service only logs recipients and subjects. Keep keys in environment variables, never in source code.

Quote-ready and deposit-confirmation emails use the existing booking lifecycle. Balance reminders and event-week logistics use the daily cron job, so configure its scheduler and authentication too. Tour confirmation uses the venue's confirmation action. Cancellation and refunds follow the existing payment processing actions.

No delivery was attempted while building these templates. Test with your own inbox after configuration, including mobile rendering and the private action links.
