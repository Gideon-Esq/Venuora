import type { Metadata } from "next";
import Link from "next/link";
import { magicLinkAction, passwordSignInAction } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/public/action-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="public-page flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <Link href="/" className="mb-8 text-xl font-semibold tracking-tight text-zinc-900">
        Venu<span className="text-indigo-600">ora</span>
      </Link>

      <div className="w-full max-w-md space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sign in with a magic link</CardTitle>
            <CardDescription>
              We&apos;ll email you a one-time sign-in link — no password needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={magicLinkAction}>
              <Label htmlFor="magic-email">Email</Label>
              <Input
                id="magic-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@yourvenue.com"
                className="mb-4"
              />
              <SubmitButton>Email me a sign-in link</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200" />
          or
          <span className="h-px flex-1 bg-zinc-200" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sign in with a password</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={passwordSignInAction}>
              <Label htmlFor="pw-email">Email</Label>
              <Input
                id="pw-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@yourvenue.com"
                className="mb-3"
              />
              <Label htmlFor="pw-password">Password</Label>
              <Input
                id="pw-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mb-4"
              />
              <SubmitButton>Sign in</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-zinc-600">
          New to Venuora?{" "}
          <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-700">
            Start your free trial
          </Link>
        </p>
      </div>
    </div>
  );
}
