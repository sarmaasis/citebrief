import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://getcitebrief.com"),
  title: {
    default: "CiteBrief",
    template: "%s · CiteBrief",
  },
  description:
    "Agencies track twenty buyer questions across ChatGPT, Perplexity, Gemini, and AI Overviews. Every Friday, CiteBrief emails a white-label report.",
  alternates: {
    canonical: "https://getcitebrief.com",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} bg-cb-bg text-cb-text font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
