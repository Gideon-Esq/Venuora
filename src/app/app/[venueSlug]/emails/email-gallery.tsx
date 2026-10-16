"use client";
import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
type Template = {name:string;kind:string;subject:string;html:string};
export function EmailGallery({templates}:{templates:Template[]}) {
  const [mobile,setMobile] = useState(false);
  return <><div className="my-6 flex justify-end"><Button variant="outline" onClick={()=>setMobile(!mobile)}>{mobile ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}{mobile ? "Mobile preview · 375px" : "Desktop preview"}</Button></div><div className="grid items-start gap-x-6 gap-y-10 xl:grid-cols-2">{templates.map(template=><section key={template.name}><h2 className="text-lg font-semibold">{template.name}</h2><p className="mt-1 text-sm text-muted-foreground">{template.kind}</p><div className="mt-4 overflow-hidden rounded-xl border border-border bg-muted p-3 shadow-sm sm:p-5"><div className="mb-4 flex flex-wrap justify-between gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground"><span>To: Lena Ortiz (sample)</span><span>Subject: {template.subject}</span></div><iframe title={`${template.name} email preview`} srcDoc={template.html} sandbox="" className="mx-auto h-[1050px] w-full rounded-lg border border-border bg-card" style={{maxWidth:mobile ? 375 : 620}} /></div></section>)}</div></>;
}
