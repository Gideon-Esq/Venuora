"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, MapPin, Menu, Sparkles, Flower2 } from "lucide-react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { searchVenues } from "./search";

const images = {
  wedding: "/landing/wedding.jpg",
  table: "/landing/reception-ready.webp",
  celebration: "/landing/celebration.jpg",
  corporate: "/landing/corporate.jpg",
  garden: "/landing/garden.jpg",
  flowers: "/landing/flowers.jpg",
  rooftop: "/landing/rooftop.jpg",
  coast: "/landing/waterfront-wedding-ready.webp",
};
const stories = [
  { title: "Weddings", sub: "For your once-in-a-lifetime.", image: images.wedding },
  { title: "Celebrations", sub: "For the moments worth bringing everyone together.", image: images.celebration },
  { title: "Corporate events", sub: "For fresh perspectives, outside the everyday.", image: images.corporate },
];
const settings = [
  { title: "Gardens", image: images.garden, hint: "Under open skies" },
  { title: "Rooftops", image: images.rooftop, hint: "A different perspective" },
  { title: "Ballrooms", image: images.wedding, hint: "A little grandeur" },
  { title: "Waterfront", image: images.coast, hint: "Wedding-ready by the water" },
  { title: "Intimate spaces", image: images.table, hint: "Closer together" },
  { title: "Conference venues", image: images.corporate, hint: "Room for ideas" },
];
const articles = [
  { title: "A guest list, with room to breathe.", category: "THE GUEST LIST", image: images.table, body: "Start with the people you want beside you. Ask the venue for capacity in your chosen layout: a seated dinner, standing reception and dance floor all use space differently. Include room for catering, entertainment and accessible routes. A floor plan or tour can help you picture the day more clearly." },
  { title: "Before you fall in love with a space.", category: "THE VENUE VISIT", image: images.garden, body: "Ask what is included, when suppliers can arrive, and when the event must finish. Check catering options, accessibility, weather contingencies and sound restrictions. Before confirming, read the payment schedule and cancellation policy, and make sure your quote reflects the details you agreed." },
  { title: "One space. So many possibilities.", category: "A LITTLE INSPIRATION", image: images.celebration, body: "Light, layout and a few thoughtful details can change how a room feels. Plan around the moments you want: a shared meal, a lively dance floor or an easy conversation. Ask which furniture and lighting options the venue supports, and check any decoration or setup rules before making plans." },
];
function Action({ href, children, light = false }: { href: string; children: ReactNode; light?: boolean }) {
  return <Link className={`vl-action ${light ? "vl-action-light" : ""}`} href={href}><span>{children}</span><span aria-hidden><ArrowUpRight size={18} /></span></Link>;
}
function Picture({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  // Locally hosted editorial photography; dimensions reserve space before loading.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" width={1200} height={900} />;
}

export function Landing() {
  const pageRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [galleryEdges, setGalleryEdges] = useState({ start: true, end: false });
  const [story, setStory] = useState(0);

  useEffect(() => {
    const page = pageRef.current;
    if (!page || !("IntersectionObserver" in window)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations: { element: HTMLElement; animation: Animation; top: number; stagger: number }[] = [];
    let frame = 0;
    let disposed = false;
    const layoutTop = (element: HTMLElement) => {
      let top = 0;
      for (let node: HTMLElement | null = element; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
      return top;
    };
    const groups = [
      { selector: ".vl-section-intro, .vl-memory-heading, .vl-journey-copy>h2, .vl-practical>div:first-child, .vl-finder>div, .vl-journal-intro, .vl-owners>div, .vl-closing-title", distance: 90, image: false },
      { selector: ".vl-setting, .vl-article, .vl-journey-photo, .vl-practical-features>div", distance: 110, image: true },
      { selector: ".vl-journey li", distance: 55, image: false },
      { selector: ".vl-memories>img, .vl-finder>img", distance: 100, image: true },
      { selector: ".vl-footer-brand", distance: 65, image: false },
    ];
    const clear = () => { animations.forEach(item => item.animation.cancel()); animations.length = 0; };
    const measure = () => animations.forEach(item => { item.top = layoutTop(item.element); });
    const render = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const scroll = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - viewport;
      for (const item of animations) {
        const end = Math.min(item.top + item.stagger - viewport * .54, maxScroll);
        const start = Math.min(item.top + item.stagger - viewport * .96, end - 1);
        const progress = Math.max(0, Math.min(1, (scroll - start) / (end - start)));
        item.animation.currentTime = item.element.contains(document.activeElement) ? 1000 : progress * 1000;
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
    const setup = () => {
      clear();
      if (motion.matches) return;
      groups.forEach(group => page.querySelectorAll<HTMLElement>(group.selector).forEach((element, index) => {
        if (typeof element.animate !== "function") return;
        // Separate translate/scale preserve the collage's original rotations.
        const animation = element.animate([
          { opacity: group.image ? .25 : 0, translate: `0 ${group.distance}px`, scale: group.image ? ".94" : "1", clipPath: group.image ? "inset(12% 0 0 0)" : "inset(0 0 0 0)" },
          { opacity: 1, translate: "0 0", scale: "1", clipPath: "inset(0 0 0 0)" },
        ], { duration: 1000, fill: "both", easing: "cubic-bezier(.16,1,.3,1)" });
        animation.pause();
        const stagger = element.matches(".vl-setting, .vl-article") ? (index % 3) * 28 : 0;
        animations.push({ element, animation, top: layoutTop(element), stagger });
      }));
      render();
    };
    const resize = () => { measure(); schedule(); };
    setup();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", resize);
    page.addEventListener("focusin", schedule);
    motion.addEventListener("change", setup);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(page);
    void document.fonts?.ready.then(() => { if (!disposed) resize(); });
    const navigation = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        page.querySelectorAll<HTMLAnchorElement>(".vl-nav nav a[href^='#']").forEach(link => {
          if (link.hash === `#${entry.target.id}`) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-15% 0px -55% 0px", threshold: 0 });
    page.querySelectorAll("main section[id]").forEach(section => navigation.observe(section));
    return () => {
      disposed = true;
      navigation.disconnect(); observer?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", resize);
      page.removeEventListener("focusin", schedule);
      motion.removeEventListener("change", setup);
      if (frame) cancelAnimationFrame(frame);
      clear();
    };
  }, []);

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;
    const updateEdges = () => setGalleryEdges({ start: gallery.scrollLeft <= 2, end: gallery.scrollLeft + gallery.clientWidth >= gallery.scrollWidth - 2 });
    updateEdges();
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateEdges) : null;
    resize?.observe(gallery);
    gallery.addEventListener("scroll", updateEdges, { passive: true });
    return () => { resize?.disconnect(); gallery.removeEventListener("scroll", updateEdges); };
  }, []);

  function moveGallery(direction: number) {
    const gallery = galleryRef.current;
    gallery?.scrollBy({ left: direction * gallery.clientWidth * 0.7, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchVenues>>>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finder, setFinder] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(5).fill(""));
  const [article, setArticle] = useState<number | null>(null);
  const [setting, setSetting] = useState<number | null>(null);
  async function search(event?: FormEvent) {
    event?.preventDefault(); setSearchOpen(true); setBusy(true); setError("");
    try { setResults(await searchVenues(location, Number(guests))); }
    catch { setError("We couldn’t load venues. Please try again in a moment."); }
    finally { setBusy(false); }
  }
  const questions = ["What are you planning?", "Where would you like to host it?", "How many guests are coming?", "What atmosphere do you prefer?", "What is your venue budget?"];
  const options = [["Wedding", "Celebration", "Corporate event"], [], ["Under 50", "50–150", "150–300", "Over 300"], ["Garden", "Contemporary", "Elegant", "Intimate", "Relaxed"], ["Still exploring", "I have a budget to discuss"]];
  return <div className="vl" ref={pageRef} id="top">
    <a className="vl-skip" href="#discover">Skip to venue search</a>
    <header className="vl-nav">
      <Link href="/" className="vl-logo"><Flower2 aria-hidden size={26} /> venuora<span>®</span></Link>
      <nav aria-label="Main navigation"><a href="#discover">Venues</a><a href="#how-it-works">How it works</a><a href="#stories">The journal</a><a href="#owners">For venue owners <ArrowUpRight size={13} /></a></nav>
      <Link href="/login" className="vl-signin">Sign in <ArrowUpRight size={15} /></Link>
      <details className="vl-menu"><summary aria-label="Open navigation"><Menu /></summary><nav aria-label="Mobile navigation"><a href="#discover">Find a venue</a><a href="#how-it-works">How it works</a><a href="#stories">The journal</a><a href="#owners">For venue owners</a><Link href="/login">Sign in</Link></nav></details>
    </header>
    <main>
      <section className="vl-hero" aria-label="Discover your next event venue">
        {stories.map((s, i) => <div key={s.title} className={`vl-hero-image ${story === i ? "active" : ""}`} style={{ backgroundImage: `url("${s.image}")` }} role="img" aria-label={i === story ? `${s.title}: an event space dressed for a gathering` : undefined} aria-hidden={i !== story} />)}
        <div className="vl-hero-shade" />
        <div className="vl-hero-content"><p className="vl-eyebrow"><span /> A PLACE FOR EVERY UNFORGETTABLE MOMENT</p><h1>Every unforgettable<br />event starts<br /><em>somewhere.</em></h1><p className="vl-hero-copy">Discover spaces for your biggest celebrations<br className="vl-desktop" /> and everything in between.</p></div>
        <aside className="vl-hero-aside"><a href="#inspiration" className="vl-feature"><Picture src={images.table} alt="Candlelit reception table with flowers and glassware" /><div><span>A LITTLE INSPIRATION</span><p>Imagine the possibilities.</p><ArrowUpRight size={20} /></div></a><a href="#discover" className="vl-location"><MapPin size={17} /><span>A beautiful space.<br />Somewhere near you.</span><ArrowUpRight size={18} /></a></aside>
        <div className="vl-hero-bottom"><div className="vl-story-tabs" role="group" aria-label="Event inspiration">{stories.map((s, i) => <button key={s.title} aria-pressed={story === i} onClick={() => setStory(i)} className={story === i ? "active" : ""}><Picture src={s.image} alt="" /><span><small>0{i + 1}</small>{s.title}</span></button>)}</div><p className="vl-story-caption" aria-live="polite">{stories[story].sub}</p><a href="#discover" className="vl-scroll" aria-label="Scroll to search"><ArrowDown size={19} /></a></div>
      </section>
      <section className="vl-discover" id="discover" aria-label="Find a venue">
        <form className="vl-search" onSubmit={search}><label><span><MapPin size={14} /> LOCATION</span><input value={location} onChange={e => setLocation(e.target.value)} placeholder="Where’s your event?" maxLength={100} /></label><label><span>EVENT DATE</span><input type="date" aria-label="Event date" value={date} onChange={e => setDate(e.target.value)} /></label><label><span>NUMBER OF GUESTS</span><input type="number" min="1" max="100000" value={guests} onChange={e => setGuests(e.target.value)} placeholder="How many people?" /></label><button type="submit" className="vl-search-button">Find a venue <ArrowUpRight size={19} /></button></form>
        <div className="vl-section-intro"><div><p className="vl-eyebrow">NOT JUST ANYWHERE. YOUR SOMEWHERE.</p><h2>A setting for <em>every story.</em></h2></div><p>Open skies or glittering ceilings.<br />Find the backdrop that feels like you.</p></div>
        <div className="vl-gallery-controls" role="group" aria-label="Browse venue settings"><span>Find your kind of setting</span><button type="button" aria-label="Previous venue settings" aria-controls="venue-settings" disabled={galleryEdges.start} onClick={() => moveGallery(-1)}><ArrowLeft size={18} /></button><button type="button" aria-label="Next venue settings" aria-controls="venue-settings" disabled={galleryEdges.end} onClick={() => moveGallery(1)}><ArrowRight size={18} /></button></div>
        <div className="vl-settings" id="venue-settings" ref={galleryRef}>{settings.map((s, i) => <button key={s.title} className="vl-setting" onClick={() => setSetting(i)}><div><Picture src={s.image} alt={`${s.title} inspiration`} /><span><ArrowUpRight size={20} /></span></div><h3>{s.title}</h3><p>{s.hint}</p></button>)}</div><p className="vl-photo-note">A collection of possibilities. Imagery includes AI-created venue inspiration, not a catalogue of listed venues.</p>
      </section>
      <section className="vl-memories" id="inspiration"><div className="vl-memory-heading"><p className="vl-eyebrow">SPACES BECOME STORIES</p><h2>A space is only<br /><em>the beginning.</em></h2><p>It’s the people, the details, and the moments<br />you bring to it that make it yours.</p><a href="#discover" className="vl-text-link">Find your beginning <ArrowUpRight size={17} /></a></div><Picture className="vl-memory-one" src={images.garden} alt="An outdoor celebration beneath warm string lights" /><Picture className="vl-memory-two" src={images.flowers} alt="Floral details prepared for a wedding" /><Picture className="vl-memory-three" src={images.table} alt="An elegantly set table awaiting guests" /><div className="vl-memory-note"><Flower2 size={28} /><span>A little magic.<br />A lot of meaning.</span></div></section>
      <section className="vl-journey" id="how-it-works"><div className="vl-journey-photo"><Picture src={images.celebration} alt="A reception space ready for an evening celebration" /><span>THE SPACE. THE DETAILS. THE DAY.</span></div><div className="vl-journey-copy"><p className="vl-eyebrow">LESS GUESSWORK. MORE POSSIBILITY.</p><h2>From your first idea<br />to <em>the day itself.</em></h2><ol>{[["Find your somewhere", "Explore venues and find a space with room for your plans."], ["Get to know the details", "Check capacity, pricing and policies. Request a tour for a closer look."], ["Make it official", "Send an enquiry, agree your quote and confirm with the venue. Some spaces also offer instant booking."], ["Make it yours", "Bring your people, your plans and your own kind of unforgettable."]].map(([title, body], i) => <li key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></div></section>
      <section className="vl-practical"><div><p className="vl-eyebrow">A LITTLE CLARITY GOES A LONG WAY</p><h2>Beautiful spaces.<br /><em>Clear decisions.</em></h2><p>Dream a little. Then get into the details.<br />The right space should feel right on paper, too.</p><Action href="#discover">Explore venues</Action></div><div className="vl-practical-features">{[["Know the space", "Explore capacity, layouts and amenities shared by the venue. Ask your host about any specific access needs.", images.rooftop], ["Know the booking", "Review the venue’s rates, deposit schedule and cancellation terms before you commit.", images.table]].map(([title, body, image]) => <div key={title}><Picture src={image} alt={title === "Know the space" ? "Warm, intimate indoor dining space" : "Thoughtfully prepared event table"} /><div><h3>{title}</h3><p>{body}</p><a href="#discover" className="vl-text-link">Find your space <ArrowUpRight size={16} /></a></div></div>)}</div></section>
      <section className="vl-finder"><Picture className="vl-finder-one" src={images.garden} alt="Garden gathering inspiration" /><Picture className="vl-finder-two" src={images.wedding} alt="Elegant ballroom inspiration" /><Picture className="vl-finder-three" src={images.rooftop} alt="Intimate restaurant inspiration" /><div><p className="vl-eyebrow"><Sparkles size={15} /> A LITTLE DISCOVERY</p><h2>What does your perfect<br />event <em>feel like?</em></h2><p>Tell us a little about your plans.<br />Find a direction that feels like you.</p><button className="vl-action" onClick={() => { setFinder(true); setStep(0); }}><span>Find my venue style</span><span><ArrowUpRight size={18} /></span></button><small>Style finder preview · inspiration, not live recommendations</small></div></section>
      <section className="vl-journal" id="stories"><div className="vl-journal-intro"><p className="vl-eyebrow">THE VENUORA JOURNAL</p><h2>Good gatherings<br />start with<br /><em>a little inspiration.</em></h2><p>Thoughtful ideas and practical advice for whatever you’re planning.</p><span className="vl-journal-mark"><Flower2 size={52} strokeWidth={1} /></span></div>{articles.map((a, i) => <button key={a.title} onClick={() => setArticle(i)} className={`vl-article vl-article-${i}`}><Picture src={a.image} alt="Event planning inspiration" /><p className="vl-eyebrow">{a.category} · 2 MIN READ</p><h3>{a.title}</h3><span>Read the story <ArrowUpRight size={16} /></span></button>)}</section>
      <section className="vl-owners" id="owners"><Picture src={images.table} alt="A venue team’s carefully prepared table setting" /><div><p className="vl-eyebrow">FOR THE PEOPLE BEHIND THE PLACE</p><h2>Your space.<br />Their next<br /><em>unforgettable event.</em></h2><p>Give your venue a beautiful home online.<br />Showcase your spaces, receive enquiries, and<br className="vl-desktop" /> manage the journey from quote to booking.</p><Action href="/register" light>List your venue</Action><Link href="/login" className="vl-owner-signin">Already part of Venuora? Sign in <ArrowUpRight size={13} /></Link></div></section>
      <section className="vl-closing" style={{ backgroundImage: `url("${images.garden}")` }}><div className="vl-closing-title"><p className="vl-eyebrow">THE NEXT CHAPTER IS YOURS</p><h2>Make room for<br />something <em>unforgettable.</em></h2><Action href="#discover" light>Explore venues</Action></div></section>
    </main>
    <footer className="vl-footer" aria-label="Venuora footer">
      <div className="vl-footer-meta">
        <span className="vl-footer-copyright">© {new Date().getFullYear()} Venuora</span>
        <span className="vl-footer-rule" aria-hidden />
        <nav aria-label="Footer navigation">
          <a href="#discover">Discover venues</a>
          <Link href="/register">List your venue</Link>
          <Link href="/login">Sign in <ArrowUpRight size={13} aria-hidden /></Link>
          <a href="#top" className="vl-back-top" aria-label="Back to top"><ArrowUp size={18} aria-hidden /></a>
        </nav>
      </div>
      <div className="vl-footer-signoff">
        <Link href="/" className="vl-footer-brand" aria-label="Venuora home"><Flower2 aria-hidden strokeWidth={1.5} /><span>Venuora</span></Link>
      </div>
    </footer>
    <Dialog open={searchOpen} onClose={() => setSearchOpen(false)} ariaLabel="Venue search results"><DialogTitle>Find your somewhere</DialogTitle><p className="vl-modal-note">{location ? `Venues matching “${location}”` : "Published venues"}{guests ? ` · space for ${guests} guests` : ""}. {date ? `Check your selected date (${date}) on the venue’s calendar.` : "Choose a venue to check availability."} Capacity may vary by layout.</p>{busy ? <p role="status">Finding spaces…</p> : error ? <div role="alert"><p>{error}</p><button className="vl-modal-button" onClick={() => search()}>Try again</button></div> : results.length ? <div className="vl-results">{results.map(v => <Link key={v.slug} href={`/v/${v.slug}${date ? `?month=${date.slice(0, 7)}#availability` : ""}`}><span><strong>{v.name}</strong><small>{v.city || "Explore venue details"}</small></span><ArrowUpRight size={20} /></Link>)}</div> : <p>No published venues match yet. Try a nearby city, fewer guests, or leave the location blank.</p>}</Dialog>
    <Dialog open={setting !== null} onClose={() => setSetting(null)} ariaLabel="Venue setting inspiration">{setting !== null && <><DialogTitle>{settings[setting].title}</DialogTitle><Picture src={settings[setting].image} alt={`${settings[setting].title} inspiration`} className="vl-modal-image" /><p className="vl-modal-note">{settings[setting].hint}. This is an inspiration collection; venue-style filtering is not connected yet. Search published venues by location and guest count, then explore their photos and details.</p><button className="vl-modal-button" onClick={() => { setSetting(null); document.getElementById("discover")?.scrollIntoView(); }}>Search venues <ArrowRight size={16} /></button></>}</Dialog>
    <Dialog open={finder} onClose={() => setFinder(false)} ariaLabel="Venue style finder preview"><DialogTitle>{step < 5 ? "A little closer to your somewhere" : "Your next chapter"}</DialogTitle><p className="vl-modal-note">STYLE FINDER PREVIEW · {step < 5 ? `${step + 1} OF 5` : "YOUR INSPIRATION"}</p><progress max={5} value={Math.min(step + 1, 5)} className="vl-progress" />{step < 5 ? <><h3 className="vl-question">{questions[step]}</h3>{step === 1 ? <label className="vl-finder-input">City or region<input placeholder="Where do you have in mind?" maxLength={100} value={answers[step]} onChange={e => setAnswers(answers.map((a, i) => i === step ? e.target.value : a))} /></label> : <div className="vl-choices">{options[step].map(option => <button key={option} aria-pressed={answers[step] === option} onClick={() => setAnswers(answers.map((a, i) => i === step ? option : a))}>{option}</button>)}</div>}<div className="vl-finder-controls"><button disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button><button className="vl-modal-button" disabled={!answers[step].trim()} onClick={() => setStep(step + 1)}>{step === 4 ? "See my direction" : "Continue"} <ArrowRight size={16} /></button></div></> : <><h3 className="vl-question">{answers[3]} spaces, with your people at the heart.</h3><p className="vl-modal-note">For your {answers[0].toLowerCase()} in {answers[1]}, start with {answers[3].toLowerCase()} settings and ask how the layout works for {answers[2].toLowerCase()} guests. {answers[4] === "I have a budget to discuss" ? "Share your budget with the venue and ask for an itemised quote." : "Ask what is included before setting your budget."}</p><p className="vl-modal-note">This is a planning direction based on your choices, not matched venues or confirmed availability. Search uses location and guest count only.</p><button className="vl-modal-button" onClick={() => { setLocation(answers[1]); setGuests(answers[2] === "Under 50" ? "" : answers[2] === "50–150" ? "50" : answers[2] === "150–300" ? "150" : "301"); setFinder(false); document.getElementById("discover")?.scrollIntoView(); }}>Use these search details <ArrowRight size={16} /></button><button className="vl-restart" onClick={() => setStep(0)}>Edit answers</button></>}</Dialog>
    <Dialog open={article !== null} onClose={() => setArticle(null)} ariaLabel="Venuora planning journal">{article !== null && <><p className="vl-modal-note">{articles[article].category}</p><DialogTitle>{articles[article].title}</DialogTitle><Picture className="vl-modal-image" src={articles[article].image} alt="Event planning inspiration" /><p className="vl-article-body">{articles[article].body}</p><div onClick={() => setArticle(null)}><Action href="#discover">Find a space to explore</Action></div></>}</Dialog>
  </div>;
}
