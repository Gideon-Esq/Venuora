// Daily automation (Vercel Cron): balance reminders (14 & 3 days before
// due), event-week logistics emails, hold expiry sweep, and completing
// past events (which triggers thank-you + security-refund notices).

import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredHolds } from "@/lib/booking";
import { db } from "@/lib/db";
import {
  completePastBookings,
  sendBalanceReminders,
  sendEventWeekEmails,
} from "@/lib/payments";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await releaseExpiredHolds(db);
  const reminders = await sendBalanceReminders([14, 3]);
  const logistics = await sendEventWeekEmails();
  const completed = await completePastBookings();

  return NextResponse.json({ ok: true, reminders, logistics, completed });
}
