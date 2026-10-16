"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
/** Preserve the mounted route and unsent form fields during connectivity loss. */
export function ConnectionNotice() {
  const [offline,setOffline] = useState(false);
  useEffect(()=>{
    const update=()=>setOffline(!navigator.onLine);
    update(); window.addEventListener("online",update); window.addEventListener("offline",update);
    return ()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};
  },[]);
  if(!offline) return null;
  return <div role="status" className="sticky top-0 z-50 flex items-start justify-center gap-3 border-b border-warning-border bg-warning-soft px-4 py-3 text-sm text-foreground"><WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><p><strong>You’re offline.</strong> Your current entries remain on this page. Reconnect before saving or paying, and check the result before trying again.</p></div>;
}
