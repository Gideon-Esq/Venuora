import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Flower2, Mail, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emailTransport } from "@/lib/email";
import styles from "./check-email.module.css";

export const metadata: Metadata = { title: "Check your inbox" };

const STEPS = [
  { title: "Find your email", body: "Look for the sign-in email from Venuora. Check spam or promotions too." },
  { title: "Follow the link", body: "Open the secure sign-in link on this device." },
  { title: "Make yourself at home", body: "Your venue workspace is ready when you are." },
];

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  const consoleMode = emailTransport() === "console";
  const steps = consoleMode ? [
    { title: "Check the server console", body: "Find the Venuora magic-link message in your development terminal." },
    { title: "Open your local link", body: "Copy the complete sign-in link into this browser." },
    { title: "Welcome to your workspace", body: "The link signs you in and opens your venue workspace." },
  ] : STEPS;

  return (
    <div className={cn("public-page", styles.page)}>
      <header className={styles.header}>
        <Link href="/" aria-label="Venuora home" className={styles.brand}><Flower2 size={29} strokeWidth={1.6} aria-hidden />venuora<span>®</span></Link>
        <Link href="/login" className={styles.back}><ArrowLeft size={16} aria-hidden /><span>Back to sign in</span></Link>
      </header>

      <main className={styles.main}>
        <section className={styles.message} aria-labelledby="check-email-title">
          <div className={styles.eyebrow}><span /> YOUR NEXT CHAPTER STARTS HERE</div>
          <div className={styles.mailIcon}><Mail size={28} strokeWidth={1.4} aria-hidden /><Flower2 className={styles.mailFlower} size={25} aria-hidden /></div>
          <h1 id="check-email-title">{consoleMode ? <>A little link.<br /><em>A fresh start.</em></> : <>Good things<br />are <em>in your inbox.</em></>}</h1>
          <p className={styles.intro}>{consoleMode ? "Your local sign-in link is waiting in the development server console. No email was sent." : "Your next event, your next enquiry, your next big moment. Your sign-in link is the way back to it all."}</p>
          {!consoleMode && <div className={styles.recipient}><Mail size={17} aria-hidden /><div><span>SIGN-IN EMAIL REQUESTED FOR</span><p>{email?.slice(0, 254) || "Your email address"}</p></div></div>}
          <div className={styles.actions}>
            <Link href="/login" className={cn(buttonVariants({ size: "lg" }), styles.primary)}>Return to sign in <ArrowUpRight size={18} aria-hidden /></Link>
            <Link href="/login" className={styles.textLink}>Use a different email</Link>
          </div>
          <p className={styles.secure}><ShieldCheck size={16} aria-hidden /> A secure link. A simple way in.</p>
        </section>

        <aside className={styles.visual} aria-label="A little inspiration while you wait">
          <Image src="/landing/reception-ready.webp" alt="A candlelit reception venue with flowers and tables prepared for a celebration" fill sizes="(max-width: 800px) 100vw, 50vw" priority className={styles.photo} />
          <div className={styles.shade} />
          <div className={styles.photoTop}><span>ROOM FOR WHAT MATTERS</span><Flower2 size={26} strokeWidth={1.2} aria-hidden /></div>
          <div className={styles.photoCopy}><p>Less busywork.<br /><em>More beautiful moments.</em></p><span>A little clarity for the people behind the place.</span></div>
          <div className={styles.photoBottom}><span>YOUR VENUE. ALL TOGETHER.</span><span>01 / THE NEXT CHAPTER</span></div>
        </aside>
      </main>

      <section className={styles.guide} aria-labelledby="next-steps-title">
        <div className={styles.guideHeading}><p className={styles.eyebrow}>JUST A FEW LITTLE STEPS</p><h2 id="next-steps-title">You’re almost <em>there.</em></h2></div>
        <ol className={styles.steps}>{steps.map((step, index) => <li key={step.title}><span className={styles.number}>0{index + 1}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>
      </section>

      <footer className={styles.footer}><p>{consoleMode ? "Configure email delivery to receive future links by email." : "Still waiting, or has your link expired?"} <Link href="/login">Request a new link <ArrowUpRight size={13} aria-hidden /></Link></p><span>A place for every unforgettable moment.</span></footer>
    </div>
  );
}
