import Link from "next/link";
import { Building2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
export default function VenueUnavailable() {
  return <main className="mx-auto flex min-h-[65vh] max-w-lg flex-col items-center justify-center px-5 text-center"><Building2 className="h-10 w-10 text-primary" aria-hidden /><h1 className="mt-5 text-2xl font-semibold">This venue page isn’t available</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">The page may not be published yet, or its address may have changed. Check the link with the venue.</p><Link href="/" className={buttonVariants({variant:"outline",className:"mt-6"})}>Return to Venuora</Link></main>;
}
