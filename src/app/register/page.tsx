import type { Metadata } from "next";
import Link from "next/link";
import { registerAction } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/public/action-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export const metadata: Metadata = { title: "Start your free trial" };

export default function RegisterPage() {
  return (
    <div className="public-page flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <Link href="/" className="mb-8 text-xl font-semibold tracking-tight text-zinc-900">
        Venu<span className="text-indigo-600">ora</span>
      </Link>

      <div className="w-full max-w-md space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create your account</CardTitle>
            <CardDescription>
              30-day free trial. You&apos;ll set up your venue right after.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={registerAction}>
              <Label htmlFor="reg-name">Your name</Label>
              <Input
                id="reg-name"
                name="name"
                autoComplete="name"
                required
                placeholder="Ada Okafor"
                className="mb-3"
              />
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@yourvenue.com"
                className="mb-3"
              />
              <Label htmlFor="reg-password">Password</Label>
              <Input
                id="reg-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="mb-1"
              />
              <p className="mb-4 text-xs text-zinc-500">At least 8 characters.</p>
              <SubmitButton>Start free trial</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
