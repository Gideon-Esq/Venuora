"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { magicLinkAction, passwordSignInAction } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/public/action-form";
import { Input, Label } from "@/components/ui/input";
import { submitPrimary } from "./auth-shell";
export function SignInForm() {
  const [mode,setMode] = useState<"password"|"email">("password");
  const [visible,setVisible] = useState(false);
  return <div><div className="mb-5 flex rounded-lg bg-muted p-1" aria-label="Sign-in method">{(["email","password"] as const).map(value=><button key={value} type="button" aria-pressed={mode===value} onClick={()=>setMode(value)} className={`min-h-10 flex-1 rounded-md text-sm font-medium ${mode===value ? "bg-card shadow-sm" : "text-muted-foreground"}`}>{value==="email" ? "Email link" : "Password"}</button>)}</div><ActionForm key={mode} action={mode==="password" ? passwordSignInAction : magicLinkAction} className="space-y-4"><div><Label htmlFor="sign-in-email">Email</Label><Input id="sign-in-email" name="email" type="email" autoComplete="email" placeholder="you@yourvenue.com" required /></div>{mode==="password" && <div><Label htmlFor="sign-in-password">Password</Label><div className="relative"><Input id="sign-in-password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required className="pr-12" placeholder="Enter your password" /><button type="button" aria-label={visible ? "Hide password" : "Show password"} onClick={()=>setVisible(!visible)} className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-muted-foreground">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>}<SubmitButton className={submitPrimary}>{mode==="password" ? "Sign in" : "Email me a sign-in link"}</SubmitButton></ActionForm><button type="button" onClick={()=>setMode(mode==="password" ? "email" : "password")} className="mt-5 min-h-11 w-full text-sm font-medium text-primary">{mode==="password" ? "Use a magic link instead" : "Use your password instead"}</button>{mode==="password" && <p className="text-center text-xs text-muted-foreground">Forgot your password? Sign in with an email link.</p>}</div>;
}
