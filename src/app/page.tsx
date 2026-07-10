import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  CalendarClock,
  Check,
  CreditCard,
  FileText,
  Globe2,
  Mail,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";

// Marketing landing for venue owners. Fully server-rendered, zero client JS.

const STEPS = [
  {
    n: "1",
    title: "Set up your spaces & rates",
    body: "Add each hall or room with photos, capacities and buffers. Set hourly rates or half-day, full-day and evening packages, weekend premiums, peak-season pricing and add-ons like chairs, AV or security. Guided setup takes about 15 minutes.",
  },
  {
    n: "2",
    title: "Take bookings — online or on the phone",
    body: "Share your public page and let clients check real availability, pick add-ons and pay a deposit online. Caller on the line? Log the booking in under a minute, pencil a hold, or text them a payment link before they hang up.",
  },
  {
    n: "3",
    title: "Get paid without chasing",
    body: "The deposit locks the date. Venuora reminds the client before the balance is due, collects the refundable security deposit, and handles cancellation refunds by your policy — automatically, to your own Stripe account.",
  },
];

const FEATURES = [
  {
    icon: CalendarCheck2,
    title: "Zero double-bookings — guaranteed by the database",
    body: "Every booking blocks its slot plus your setup and teardown time, enforced at the database level. Two people can grab the same Saturday at the same second; exactly one succeeds, the other instantly sees alternative dates and spaces.",
  },
  {
    icon: PhoneCall,
    title: "Phone bookings in under 45 seconds",
    body: "A fast form built for taking bookings while the caller is on the line: name, phone, date, time — priced automatically. Log it as an inquiry, send a quote, pencil a hold until Friday, or confirm with a deposit link.",
  },
  {
    icon: CreditCard,
    title: "Deposits, balances & caution fees, handled",
    body: "Deposit at confirmation, balance reminders 14 and 3 days before due, refundable security deposit collected with the balance and settled after the event — with itemized deductions if the party got out of hand.",
  },
  {
    icon: Globe2,
    title: "A public page that wins the booking",
    body: "Photos, capacities, transparent from-pricing and a live free/busy calendar. Choose instant booking per space, or vet every event with request-to-book. Clients never see other clients' details.",
  },
  {
    icon: FileText,
    title: "One-click quotes that close themselves",
    body: "Turn any inquiry into a branded quote with line items, terms and a validity date. The client clicks “Accept & pay deposit” and the booking confirms itself — no back-and-forth.",
  },
  {
    icon: Mail,
    title: "Emails that look like you, not us",
    body: "Inquiry acknowledgments, receipts, balance reminders, event-week logistics and thank-yous — all sent under your venue's name, logo and colors. Plus tour-request scheduling for prospective clients.",
  },
];

// Every plan includes every feature — tiers differ ONLY by bookable spaces.
const EVERY_PLAN = [
  "Unlimited bookings & clients",
  "Double-booking protection with setup/teardown buffers",
  "Owner calendar (month, week & day views)",
  "45-second phone booking form",
  "Public venue page with live availability",
  "Online payments & deposits via your own Stripe account",
  "Quotes with accept-&-pay links",
  "Balance reminders & automated emails",
  "Refundable security deposits & cancellation policies",
  "Tour request scheduling",
  "Team access (owner, manager, staff roles)",
];

const PLANS = [
  {
    name: "Solo",
    price: "$49",
    spaces: "1 bookable space",
    blurb: "One hall, run properly.",
    example: "A single banquet hall or church auditorium.",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$99",
    spaces: "Up to 5 bookable spaces",
    blurb: "For venues with more than one room.",
    example: "A main hall, a garden pavilion and a meeting room.",
    highlight: true,
  },
  {
    name: "Pro",
    price: "$199",
    spaces: "Up to 10 bookable spaces",
    blurb: "Multi-space complexes and busy teams.",
    example: "An event center with ballrooms, marquees and boardrooms.",
    highlight: false,
  },
];

const FAQS = [
  {
    q: "What counts as a “space”?",
    a: "Anything you rent out separately with its own calendar: a hall, a garden marquee, a boardroom. If clients can book it on its own, it's a space. Your plan sets how many spaces you can list — nothing else changes between plans.",
  },
  {
    q: "What's the 3% fee on online bookings?",
    a: "When a client pays online by card, Venuora adds a 3% platform fee on that payment (on top of Stripe's standard card processing). Bookings you take by phone and collect by cash or bank transfer have no fee — record them in one click and pay only your subscription.",
  },
  {
    q: "Where does my clients' money go?",
    a: "Directly to your own Stripe account — Venuora never holds your money. Deposits, balances and security deposits settle to your bank on Stripe's normal payout schedule, and refunds go out from your account under your name.",
  },
  {
    q: "Do my clients need an account?",
    a: "No. They book, pay, view their booking, pay the balance or cancel through a private link in their email — no passwords, no app to install.",
  },
  {
    q: "Can I change plans or cancel?",
    a: "Anytime. Upgrade when you add spaces, downgrade or cancel from your billing settings — your data stays yours either way. The first 30 days are free on every plan, no card required.",
  },
  {
    q: "What about hourly rates vs packages?",
    a: "Both. Each space can have an hourly rate (with a minimum) and half-day, full-day and evening packages, plus weekend premiums, peak-season pricing (e.g. “Dec 15–31: +40%”), overtime rates and priced add-ons like chairs, AV or security.",
  },
];

export default function Home() {
  return (
    <div className="public-page flex flex-1 flex-col bg-white text-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900">
            Venu<span className="text-indigo-600">ora</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="#pricing"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 sm:block"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              Start free trial
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-96 bg-gradient-to-b from-indigo-50 to-transparent"
          />
          <div className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
            <p className="mx-auto mb-4 inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              Booking software for event halls & venues
            </p>
            <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zinc-900 sm:text-6xl">
              Never double-book your hall again
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-8 text-zinc-600">
              Venuora runs your venue&apos;s calendar, deposits and client
              bookings in one place — so the date is either free, or it
              isn&apos;t. No more sticky notes, WhatsApp threads or awkward
              refund calls.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-indigo-600 px-6 text-base font-medium text-white shadow-sm hover:bg-indigo-700"
              >
                Start free trial <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/v/regency-event-center"
                className="inline-flex h-12 items-center rounded-lg border border-zinc-300 bg-white px-6 text-base font-medium text-zinc-900 hover:bg-zinc-50"
              >
                See a live venue page
              </Link>
            </div>
            <p className="mt-4 text-sm text-zinc-500">
              30 days free on every plan · No credit card required
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-zinc-100 bg-zinc-50">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight text-zinc-900">
              How Venuora works
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-zinc-600">
              From empty calendar to money in the bank, in three steps.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                    {s.n}
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-zinc-900">
            Everything a hall needs. Nothing it doesn&apos;t.
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <f.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-base font-semibold text-zinc-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-zinc-100 bg-zinc-50">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight text-zinc-900">
              Pricing that&apos;s as simple as we could make it
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-600">
              <strong className="text-zinc-900">Every plan includes every feature.</strong> The
              only difference is how many bookable spaces your venue has. Pay
              monthly, plus 3% on online card payments — phone and cash
              bookings are always free to record.
            </p>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {PLANS.map((p) => (
                <div
                  key={p.name}
                  className={
                    p.highlight
                      ? "relative rounded-2xl border-2 border-indigo-600 bg-white p-6 shadow-md"
                      : "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                  }
                >
                  {p.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-medium text-white">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-base font-semibold text-zinc-900">{p.name}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{p.blurb}</p>
                  <p className="mt-4">
                    <span className="text-4xl font-semibold tracking-tight text-zinc-900">
                      {p.price}
                    </span>
                    <span className="text-sm text-zinc-500"> / month</span>
                  </p>
                  <p className="mt-4 flex items-start gap-2 text-sm font-medium text-zinc-900">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
                    {p.spaces}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{p.example}</p>
                  <p className="mt-3 flex items-start gap-2 text-sm text-zinc-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
                    All features included
                  </p>
                  <p className="mt-1.5 flex items-start gap-2 text-sm text-zinc-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
                    30-day free trial
                  </p>
                  <Link
                    href="/register"
                    className={
                      p.highlight
                        ? "mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                        : "mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                    }
                  >
                    Start free trial
                  </Link>
                </div>
              ))}
            </div>

            {/* What every plan includes */}
            <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
              <h3 className="text-base font-semibold text-zinc-900">
                Included in every plan
              </h3>
              <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {EVERY_PLAN.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* The money, plainly */}
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <CreditCard className="h-5 w-5" aria-hidden />
                </div>
                <h4 className="text-sm font-semibold text-zinc-900">Online payments: 3%</h4>
                <p className="mt-1.5 text-sm leading-6 text-zinc-600">
                  A client books and pays a $500 deposit online → $15 platform
                  fee, the rest lands in <em>your</em> Stripe account. Card
                  processing fees are Stripe&apos;s standard rates.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <PhoneCall className="h-5 w-5" aria-hidden />
                </div>
                <h4 className="text-sm font-semibold text-zinc-900">Phone & cash bookings: free</h4>
                <p className="mt-1.5 text-sm leading-6 text-zinc-600">
                  Take the booking by phone, collect cash or a bank transfer,
                  record it in one click. No fee — those bookings cost you
                  nothing beyond your subscription.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </div>
                <h4 className="text-sm font-semibold text-zinc-900">Your money, your Stripe</h4>
                <p className="mt-1.5 text-sm leading-6 text-zinc-600">
                  Payments go directly to your own Stripe account and pay out
                  to your bank on Stripe&apos;s schedule. Venuora never holds
                  your funds.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-zinc-900">
            Questions venue owners ask us
          </h2>
          <dl className="mt-10 space-y-4">
            {FAQS.map((f) => (
              <div key={f.q} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <dt className="text-base font-semibold text-zinc-900">{f.q}</dt>
                <dd className="mt-2 text-sm leading-6 text-zinc-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-zinc-100 bg-zinc-950">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6">
            <CalendarClock className="mb-5 h-8 w-8 text-indigo-400" aria-hidden />
            <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white">
              Your next Saturday is worth thousands. Stop risking it to a paper diary.
            </h2>
            <Link
              href="/register"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-indigo-500 px-6 text-base font-medium text-white shadow-sm hover:bg-indigo-400"
            >
              Start free trial <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <p className="mt-3 text-sm text-zinc-400">
              Set up your venue in under 15 minutes. 30 days free.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-100 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:px-6">
          <p>
            <span className="font-semibold text-zinc-700">Venuora</span> — booking software for
            event venues.
          </p>
          <nav className="flex items-center gap-5">
            <Link href="#pricing" className="hover:text-zinc-900">
              Pricing
            </Link>
            <Link href="/login" className="hover:text-zinc-900">
              Sign in
            </Link>
            <Link href="/register" className="hover:text-zinc-900">
              Start free trial
            </Link>
          </nav>
          <p>© {new Date().getFullYear()} Venuora</p>
        </div>
      </footer>
    </div>
  );
}
