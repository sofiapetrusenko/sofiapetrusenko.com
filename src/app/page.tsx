import type { Metadata } from "next";
import { profile } from "@/content";
import { Background } from "@/components/Background";
import { Contact } from "@/components/Contact";
import { Hero } from "@/components/Hero";
import { Reveal } from "@/components/Reveal";
import { SelectedWork } from "@/components/SelectedWork";

export const metadata: Metadata = {
  title: profile.name,
  description: profile.summary,
};

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 sm:px-8 sm:py-32">
      {/*
        Between-section gap is far larger than any gap inside a section, so the
        grouping survives a squint test. The hero is deliberately not wrapped in
        Reveal: it is the LCP element and must not start at opacity 0.
      */}
      <main className="flex flex-col gap-32 sm:gap-40">
        <Hero />
        <Reveal>
          <SelectedWork />
        </Reveal>
        <Reveal>
          <Background />
        </Reveal>
      </main>
      <Reveal>
        <Contact />
      </Reveal>
    </div>
  );
}
