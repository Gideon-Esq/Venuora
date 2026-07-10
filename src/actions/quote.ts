"use server";

import { redirect } from "next/navigation";
import { acceptQuote } from "@/lib/quotes";

export async function acceptQuoteAction(token: string) {
  const result = await acceptQuote(token);
  if (!result.ok) return result;
  redirect(result.paymentUrl);
}
