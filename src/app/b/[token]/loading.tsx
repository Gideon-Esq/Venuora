import { Loader2 } from "lucide-react";
export default function LoadingBooking() {
  return <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-12" aria-busy="true"><p role="status" className="flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />Loading booking details. We are securely checking your private link.</p>{[1,2,3].map(i => <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-muted" />)}</main>;
}
