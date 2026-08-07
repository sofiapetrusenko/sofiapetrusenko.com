import type { Metadata } from "next";
import NextLink from "next/link";
import { colophon, labels } from "@/content";
import { ProcessStrip } from "@/components/ProcessStrip";
import { Reveal } from "@/components/Reveal";
import { SectionLabel } from "@/components/Section";

export const metadata: Metadata = {
  title: labels.colophonTitle,
  description: colophon.intro,
};

export default function ColophonPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 sm:px-8 sm:py-32">
      <main className="flex flex-col gap-20 sm:gap-24">
        <header>
          <h1 className="text-[clamp(2.25rem,7vw,3.5rem)] leading-[0.98] font-semibold tracking-[-0.02em] text-balance">
            {labels.colophonTitle}
          </h1>
          <p className="mt-6 max-w-[68ch] text-lg leading-relaxed">
            {colophon.intro}
          </p>
        </header>

        <Reveal>
          <section>
            <SectionLabel>{labels.process}</SectionLabel>
            <ProcessStrip steps={colophon.steps} />
          </section>
        </Reveal>

        <Reveal>
          <section>
            <SectionLabel>{labels.numbers}</SectionLabel>
            <dl className="flex flex-wrap gap-x-12 gap-y-6">
              {colophon.numbers.map((entry) => (
                <div key={entry.label}>
                  <dt className="text-accent font-mono text-2xl">
                    {entry.value}
                  </dt>
                  <dd className="text-muted mt-1 font-mono text-xs tracking-wider">
                    {entry.label}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </Reveal>

        <Reveal>
          <section>
            <SectionLabel>{labels.principles}</SectionLabel>
            <ul className="flex flex-col gap-4">
              {colophon.principles.map((principle) => (
                <li
                  key={principle}
                  className="border-hairline max-w-[68ch] border-l-2 pl-4 leading-relaxed"
                >
                  {principle}
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      </main>

      <footer className="border-hairline mt-32 border-t pt-10 sm:mt-40">
        <NextLink
          href="/"
          className="link-underline text-accent font-mono text-sm"
        >
          {labels.backToHome}
        </NextLink>
      </footer>
    </div>
  );
}
