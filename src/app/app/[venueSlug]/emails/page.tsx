import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { requireVenue } from "@/lib/tenancy";
import { brandOf } from "@/lib/payments";
import { quoteEmail, depositReceiptEmail, balanceReminderEmail, tourConfirmedEmail, magicLinkEmail, inquiryAckEmail, tourRequestOwnerEmail, paymentFailedEmail, thankYouEmail, type BookingSummary } from "@/lib/email-templates";
import { EmailGallery } from "./email-gallery";
export const metadata: Metadata = { title: "Email templates" };
export default async function EmailTemplatesPage({params}: {params: Promise<{venueSlug:string}>}) {
  const { venueSlug } = await params;
  const { venue } = await requireVenue(venueSlug, "MANAGER");
  const brand = brandOf(venue);
  // Deliberate sample data: previews never fetch or expose real client records.
  const booking: BookingSummary = { clientName:"Lena Ortiz", spaceName:"Sample event space", eventType:"WEDDING", start:new Date("2026-11-18T22:00:00Z"),end:new Date("2026-11-19T03:00:00Z"),guestCount:80,totalCents:214700,depositCents:107400,securityDepositCents:50000,balanceDueDate:new Date("2026-11-04T17:00:00Z"),setupBufferMins:120,manageUrl:"https://example.com/booking-preview" };
  const tour = {name:booking.clientName,requestedAt:booking.start};
  const templates = [
    {name:"Tour confirmation",kind:"Venue-branded · confirmed appointment",...tourConfirmedEmail(brand,tour)},
    {name:"Magic-link sign-in",kind:"Venuora-branded · secure account access",...magicLinkEmail("https://example.com/sign-in-preview")},
    {name:"Booking request received",kind:"Venue-branded · request acknowledgement",...inquiryAckEmail(brand,booking)},
    {name:"New tour request",kind:"Venue team · request notification",...tourRequestOwnerEmail(brand,{...tour,email:"lena@example.com",phone:null,notes:"Interested in hosting a wedding reception."},"https://example.com/tour-preview")},
    {name:"Payment failed",kind:"Venue-branded · retry payment",...paymentFailedEmail(brand,booking,booking.manageUrl)},
    {name:"Event thank you",kind:"Venue-branded · completed event",...thankYouEmail(brand,booking,"Your venue will review any refundable security deposit after the event.")},
    {name:"Quote ready",kind:"Venue-branded · review and accept",...quoteEmail(brand,booking,"https://example.com/quote-preview",new Date("2026-10-30T17:00:00Z"))},
    {name:"Deposit confirmation",kind:"Venue-branded · booking confirmed",...depositReceiptEmail(brand,booking,booking.depositCents)},
    {name:"Balance reminder",kind:"Venue-branded · upcoming payment",...balanceReminderEmail(brand,booking,107300,booking.manageUrl)},
  ];
  return <main className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-8"><p className="flex items-center gap-2 text-sm font-medium text-primary"><Mail className="h-4 w-4" aria-hidden />Transactional email system</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Client-facing email showcase</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Responsive previews for {venue.name} booking communication and Venuora account emails.</p><p className="mt-4 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">Sample recipient and event details. Preview links are inactive. No emails are sent from this gallery.</p><EmailGallery templates={templates} /></main>;
}
