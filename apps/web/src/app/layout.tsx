import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// Every page renders per request, so Next can put the CSP nonce from middleware on its scripts.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nuvantre — Your AI marketing team for SaaS",
  description:
    "Nuvantre reads your SaaS, writes your product brief, and runs SEO, launches, social and analytics every week. You approve everything before it goes live.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
