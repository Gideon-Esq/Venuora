import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Flower2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import styles from "./auth-shell.module.css";

// Presentation only; authentication remains in the existing forms and actions.
export function AuthShell({ children, promotional = false }: { children: ReactNode; promotional?: boolean }) {
  if (promotional) return (
    <div className={`public-page ${styles.shell}`}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}><Flower2 size={27} aria-hidden /> venuora<span>®</span></Link>
        <Link href="/" className={styles.home}>Back to Venuora <ArrowUpRight size={16} aria-hidden /></Link>
      </header>
      <main className={styles.content}>
        <section className={styles.story} aria-labelledby="owner-welcome">
          <div className={styles.photo} role="img" aria-label="An elegant venue with a fully prepared candlelit reception table" />
          <div className={styles.overlay} />
          <div className={styles.storyCopy}>
            <p className={styles.eyebrow}>FOR THE PEOPLE BEHIND THE PLACE</p>
            <h1 id="owner-welcome">Beautiful spaces.<br /><em>Calmer days.</em></h1>
            <p>Your next unforgettable event starts with a little less busywork. Keep your calendar, enquiries and bookings in one place.</p>
            <div className={styles.caption}><span>A little clarity. A lot of possibility.</span><Flower2 size={23} strokeWidth={1.3} aria-hidden /></div>
          </div>
        </section>
        <div className={styles.form}><div className={styles.formInner}>{children}</div></div>
      </main>
      <footer className={styles.footer}>A place for every unforgettable moment.</footer>
    </div>
  );
  return (
    <div className="public-page flex flex-1 flex-col items-center px-4 py-12 sm:justify-center">
      <Link href="/" className="mb-10 rounded-md text-2xl font-semibold tracking-tight text-primary focus-visible:outline-2 focus-visible:outline-ring">Venuora</Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

export const submitPrimary = cn(buttonVariants(), "w-full");
export const submitOutline = cn(buttonVariants({ variant: "outline" }), "w-full");
export const textLink = "rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring";
