import type { Metadata } from "next";
import { Landing } from "./_landing/landing";
import "./_landing/landing.css";

export const metadata: Metadata = {
  title: "Venuora — A place for every unforgettable moment",
  description: "Discover spaces for celebrations, weddings and corporate events. Explore venue details, enquire and plan your next unforgettable gathering.",
};

export default function Home() {
  return <Landing />;
}
