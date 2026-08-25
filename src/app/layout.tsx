import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { profile } from "@/content";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sofiapetrusenko.dev"),
  title: {
    default: profile.name,
    template: `%s — ${profile.name}`,
  },
  description: profile.headline,
  openGraph: {
    title: "Sofia Petrusenko — AI & Longevity",
    description:
      "Production LLM systems, longevity research tooling, end-to-end engineering.",
    url: "https://sofiapetrusenko.dev",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetBrainsMono.variable}`}>
      <head>
        {/* Without JS the reveal wrapper would never un-hide its contents. */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body>
        {/*
          Dot grid: a 1px dot every 32px at 3.5% opacity. Enough to give the
          black a surface without reading as a pattern.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 opacity-[0.035]"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--color-fg) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {children}
      </body>
      <GoogleAnalytics gaId="G-TMXHBTE4SS" />
    </html>
  );
}
