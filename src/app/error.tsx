"use client";

import { useEffect, useTransition } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60dvh] flex-1 items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-danger-soft text-destructive">
          <TriangleAlert className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Something went wrong</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          We couldn&apos;t load this page. Your bookings and payments are safe. Check your connection
          and try again.
        </p>
        <Button className="mt-7" disabled={pending} onClick={() => startTransition(unstable_retry)}>
          <RotateCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} aria-hidden />
          {pending ? "Retrying…" : "Try again"}
        </Button>
      </div>
    </main>
  );
}
