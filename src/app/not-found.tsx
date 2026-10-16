import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
          <Compass className="h-6 w-6" aria-hidden />
        </span>
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          This page doesn&apos;t exist or may have moved. Check the address, or return to your venues to continue.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Link href="/app" className={buttonVariants()}>
            Go to your venues
          </Link>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Venuora home
          </Link>
        </div>
      </div>
    </main>
  );
}
