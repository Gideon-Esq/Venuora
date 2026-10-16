import { Link2Off } from "lucide-react";
export default function MissingBooking() {
  return <main className="mx-auto flex min-h-[65vh] max-w-lg flex-col items-center justify-center px-5 text-center"><Link2Off className="h-10 w-10 text-primary" aria-hidden /><h1 className="mt-5 text-2xl font-semibold">This private link is no longer available</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Check that you copied the full link from your email. Contact the venue to request a new link or get help with your booking.</p></main>;
}
