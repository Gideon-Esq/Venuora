import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { db } from "./db";
import { magicLinkEmail } from "./email-templates";
import { emailTransport, sendEmail } from "./email";

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" }, // Credentials provider requires JWT sessions
  pages: { signIn: "/login", verifyRequest: "/login/check-email", error: "/login/error" },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM?.trim() || "Venuora <onboarding@resend.dev>",
      // Keep the existing provider ID so saved magic-link flows remain compatible.
      async sendVerificationRequest({ identifier, url }) {
        if (emailTransport() === "console") {
          console.log(`\n🔑 Magic link for ${identifier}:\n${url}\n`);
          return;
        }
        const { subject, html, text } = magicLinkEmail(url);
        await sendEmail({ to: identifier, subject, html, text });
      },
    }),
    Credentials({
      name: "Email & password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.toLowerCase().trim();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;
        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
