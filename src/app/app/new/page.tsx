import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/tenancy";
import { NewVenueForm } from "./new-venue-form";

export const metadata = { title: "Create a venue — Venuora" };

export default async function NewVenuePage() {
  await requireUser();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-xl items-center justify-between gap-3 px-4">
          <Link
            href="/app"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to venues
          </Link>
          <span className="text-lg font-semibold tracking-tight text-foreground">Venuora</span>
        </div>
      </header>
      {/* Extra bottom padding on mobile leaves room for the sticky submit bar. */}
      <main className="mx-auto w-full max-w-xl px-4 pb-32 pt-8 sm:pb-14 sm:pt-12">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Create your venue</h1>
        <p className="mt-2 text-muted-foreground">
          Just the basics for now. You can complete the rest in setup.
        </p>
        <div className="mt-6">
          <NewVenueForm />
        </div>
      </main>
    </div>
  );
}
