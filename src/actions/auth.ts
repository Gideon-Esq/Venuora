"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { signIn, signOut } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function registerAction(formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing?.passwordHash) return { ok: false, error: "An account with this email already exists — sign in instead." };

  const passwordHash = await hash(password, 10);
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { name, passwordHash } });
  } else {
    await db.user.create({ data: { name, email, passwordHash, emailVerified: new Date() } });
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: "Sign-in failed after registration" };
    throw err;
  }
  redirect("/app");
}

export async function passwordSignInAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: "Invalid email or password" };
    throw err;
  }
  redirect("/app");
}

export async function magicLinkAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!email.includes("@")) return { ok: false, error: "Enter a valid email" };
  try {
    await signIn("resend", { email, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: "Could not send the magic link" };
    throw err;
  }
  redirect("/login/check-email");
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
