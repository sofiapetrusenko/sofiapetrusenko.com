import type { Metadata } from "next";
import { profile } from "@/content";
import { Background } from "@/components/Background";
import { Contact } from "@/components/Contact";
import { Hero } from "@/components/Hero";
import { SelectedWork } from "@/components/SelectedWork";

export const metadata: Metadata = {
  title: profile.name,
  description: profile.summary,
};

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8 sm:py-24">
      <main className="flex flex-col gap-20">
        <Hero />
        <SelectedWork />
        <Background />
      </main>
      <Contact />
    </div>
  );
}
