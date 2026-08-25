import type { Metadata } from "next";
import { notes, profile } from "@/content";
import { Background } from "@/components/Background";
import { Contact } from "@/components/Contact";
import { Hero } from "@/components/Hero";
import { NotesList } from "@/components/NotesList";
import { Reveal } from "@/components/Reveal";
import { ScrollCue } from "@/components/ScrollCue";
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
        {/* Guarded here too, so an empty notes array leaves no stray gap. */}
        {notes.length > 0 && (
          <Reveal>
            <NotesList />
          </Reveal>
        )}
        <Reveal>
          <Background />
        </Reveal>
      </main>
      <Reveal>
        <Contact />
      </Reveal>
      {/*
        Fixed to the viewport, so it takes no space and its position in the DOM
        is arbitrary — it sits last only to keep it out of the reading order.
      */}
      <ScrollCue />
    </div>
  );
}
