import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, Flower2 } from "lucide-react";
import { RegisterForm } from "./register-form";
import styles from "./register.module.css";

export const metadata: Metadata = { title: "Your venue’s next chapter — Start your free trial" };

export default function RegisterPage() {
  return (
    <div className={`public-page ${styles.page}`}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="Venuora home"><Flower2 size={26} aria-hidden /><span>Venuora</span></Link>
        <p>Already have an account? <Link href="/login">Sign in <ArrowUpRight size={14} aria-hidden /></Link></p>
      </header>
      <main className={styles.main}>
        <section className={styles.editorial} aria-labelledby="venue-story">
          <div className={styles.scene} role="img" aria-label="Illustrative candlelit venue, with ivory linens, flowers and tables ready for guests" />
          <div className={styles.shade} />
          <div className={styles.photoLabel}><span /> A BEAUTIFUL SPACE. A NEW BEGINNING.</div>
          <div className={styles.story}>
            <p className={styles.eyebrow}>FOR THE PEOPLE BEHIND THE PLACE</p>
            <h2 id="venue-story">Your space.<br />Their next<br /><em>unforgettable.</em></h2>
            <p>You bring the place. We help with the plans.<br />Showcase your venue and keep enquiries,<br className={styles.desktopBreak} /> quotes and bookings beautifully in order.</p>
            <div className={styles.storyFooter}><span>Less busywork. More possibility.</span><Flower2 size={26} strokeWidth={1.2} aria-hidden /></div>
          </div>
        </section>
        <section className={styles.signup} aria-labelledby="create-account">
          <div className={styles.intro}>
            <p className={styles.eyebrow}>YOUR NEXT CHAPTER STARTS HERE</p>
            <h1 id="create-account">Make room for<br /><em>what’s next.</em></h1>
            <p>Create your Venuora account. You’ll add your venue and spaces next.</p>
          </div>
          <div className={styles.trial}><span className={styles.trialIcon}><Check size={15} aria-hidden /></span><p><strong>30 days to make yourself at home.</strong><span>Start your free trial. No credit card required.</span></p></div>
          <div className={styles.form}><RegisterForm /></div>
          <div className={styles.next}><span>01 <span aria-hidden>—</span> CREATE YOUR ACCOUNT</span><span>02 <span aria-hidden>—</span> SET UP YOUR VENUE</span></div>
        </section>
      </main>
      <footer className={styles.footer}><span>A place for every unforgettable moment.</span><Link href="/">Explore Venuora <ArrowUpRight size={13} aria-hidden /></Link></footer>
    </div>
  );
}
