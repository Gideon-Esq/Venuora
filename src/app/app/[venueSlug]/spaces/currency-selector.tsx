"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateVenueCurrencyAction } from "@/actions/venue";
import { CURRENCIES } from "@/lib/currencies";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";
export function CurrencySelector({slug,currency}:{slug:string;currency:string}) {
  const router=useRouter();
  const [selected,setSelected]=useState(currency.toLowerCase());
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState<{ok:boolean;text:string}|null>(null);
  return <section className="mb-5 space-y-3 rounded-xl border border-border bg-card p-5"><div><h2 className="font-semibold">Rate currency</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Choose the currency for all spaces, add-ons, quotes and payments at this venue. Changing currency does not convert amounts; review your rates and policies before taking bookings.</p></div><div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end"><div className="w-full sm:max-w-xs"><Label htmlFor="venue-rate-currency">Currency</Label><Select id="venue-rate-currency" value={selected} disabled={pending} onChange={event=>{setSelected(event.target.value);setMessage(null);}}>{!CURRENCIES.some(item=>item.code===currency.toLowerCase()) && <option value={currency.toLowerCase()}>{currency.toUpperCase()}</option>}{CURRENCIES.map(item=><option key={item.code} value={item.code}>{item.code.toUpperCase()} — {item.name}</option>)}</Select></div><Button type="button" disabled={pending||selected===currency.toLowerCase()} onClick={async()=>{setPending(true);setMessage(null);try{const result=await updateVenueCurrencyAction(slug,selected);setMessage(result.ok ? {ok:true,text:"Currency saved. Review your rates before taking bookings."} : {ok:false,text:result.error});if(result.ok)router.refresh();}catch{setMessage({ok:false,text:"Could not save currency. Please try again."});}finally{setPending(false);}}}>{pending ? "Saving…" : "Save currency"}</Button></div>{message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-success" : "text-destructive"}`}>{message.text}</p>}</section>;
}
