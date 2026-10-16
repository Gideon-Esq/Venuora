"use client";
import { useState } from "react";
import { registerAction } from "@/actions/auth";
import { registerSchema } from "@/lib/validators";
import { ActionForm, SubmitButton } from "@/components/public/action-form";
import { Input, Label, FieldHint } from "@/components/ui/input";
import { submitPrimary } from "../login/auth-shell";
export function RegisterForm() {
  const [errors,setErrors] = useState<Record<string,string>>({});
  return <ActionForm className="space-y-5" action={async data=>{
    const result=registerSchema.safeParse({name:data.get("name"),email:data.get("email"),password:data.get("password")});
    if(!result.success) { const next:Record<string,string>={}; for(const issue of result.error.issues) next[String(issue.path[0])] = issue.message; setErrors(next); document.getElementById(`register-${Object.keys(next)[0]}`)?.focus(); return {ok:false,error:"Check the highlighted fields."}; }
    setErrors({}); return registerAction(data);
  }}>{[{name:"name",label:"Full name",type:"text",placeholder:"Your full name",autoComplete:"name"},{name:"email",label:"Work email",type:"email",placeholder:"you@yourvenue.com",autoComplete:"email"},{name:"password",label:"Password",type:"password",placeholder:"Create a password",autoComplete:"new-password"}].map(field=><div key={field.name}><Label htmlFor={`register-${field.name}`}>{field.label}<span className="ml-1 text-destructive" aria-hidden>*</span></Label><Input id={`register-${field.name}`} name={field.name} type={field.type} autoComplete={field.autoComplete} placeholder={field.placeholder} aria-required="true" aria-invalid={!!errors[field.name]} aria-describedby={errors[field.name] ? `error-${field.name}` : undefined} />{field.name==="password" && <FieldHint>Use at least 8 characters.</FieldHint>}{errors[field.name] && <FieldHint id={`error-${field.name}`} error>{errors[field.name]}</FieldHint>}</div>)}<SubmitButton className={submitPrimary}>Create account</SubmitButton></ActionForm>;
}
