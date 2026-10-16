"use client";

import * as React from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function ReadOnlyNotice({ children, className }: { children: React.ReactNode; className?: string }) {
  const [open, setOpen] = React.useState(false);
  return <><button type="button" className={className} onClick={() => setOpen(true)}>{children}</button><Dialog open={open} onClose={() => setOpen(false)} ariaLabel="Read-only booking access"><LockKeyhole className="mb-3 h-7 w-7 text-primary" aria-hidden /><DialogTitle>Booking summaries only</DialogTitle><DialogDescription>Your staff access lets you review this summary. Contact the venue owner or manager to open details or make changes.</DialogDescription><Button className="w-full" onClick={() => setOpen(false)}>Got it</Button></Dialog></>;
}
