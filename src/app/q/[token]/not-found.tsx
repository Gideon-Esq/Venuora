import { Link2Off } from "lucide-react";
export default function MissingQuote() {
  return <main className="mx-auto flex min-h-[65vh] max-w-lg flex-col items-center justify-center px-5 text-center"><Link2Off className="h-10 w-10 text-primary" aria-hidden /><h1 className="mt-5 text-2xl font-semibold">We couldn’t open this quote</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">This link may be incomplete or no longer available. Check the link in your email or contact the venue for an updated quote.</p></main>;
}
