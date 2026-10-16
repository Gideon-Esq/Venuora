import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ConnectionNotice } from "@/components/system/connection-notice";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Venuora — Never double-book your hall again",
    template: "%s · Venuora",
  },
  description:
    "Venuora is booking software for event venues: zero double-bookings enforced by the database, deposits collected upfront via Stripe, and a public page that wins the booking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><ConnectionNotice />{children}</body>
    </html>
  );
}
