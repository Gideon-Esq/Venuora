import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthShell, textLink } from "./auth-shell";
import { SignInForm } from "./sign-in-form";
export const metadata: Metadata = { title: "Sign in" };
export default function LoginPage() {
  return <AuthShell promotional><Card><CardHeader><CardTitle className="text-2xl">Welcome back</CardTitle><CardDescription>Sign in to manage your venue.</CardDescription></CardHeader><CardContent><SignInForm /></CardContent></Card><p className="mt-6 text-center text-sm text-muted-foreground">New to Venuora? <Link href="/register" className={textLink}>Start a 30-day trial</Link></p></AuthShell>;
}
