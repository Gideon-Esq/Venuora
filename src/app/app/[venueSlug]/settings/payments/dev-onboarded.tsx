"use client";

// Dev-mode Stripe Connect return handler: when we land back with
// ?dev_onboarded=1, mark the venue as charges-enabled and clean the URL.

import * as React from "react";
import { useRouter } from "next/navigation";
import { markDevOnboardedAction } from "@/actions/venue";

export function DevOnboardedHandler({ slug }: { slug: string }) {
  const router = useRouter();
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void markDevOnboardedAction(slug).then(() => {
      router.replace(`/app/${slug}/settings/payments`);
      router.refresh();
    });
  }, [slug, router]);

  return null;
}
