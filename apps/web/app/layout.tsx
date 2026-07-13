import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Outfit } from "next/font/google";
import { CrossTabAuth } from "@/components/cross-tab-auth";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://serenify.tech"),
  title: "Serenify",
  description: "Workplace stress, gently noticed.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Serenify",
    description: "Workplace stress, gently noticed.",
    url: "https://serenify.tech",
    siteName: "Serenify",
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Serenify",
    description: "Workplace stress, gently noticed.",
    images: ["/opengraph-image"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Per-request CSP nonce set by proxy.ts on the forwarded request headers.
  // `?? undefined` (not null) so React omits the attribute when absent rather
  // than rendering nonce="null". See docs/security/05-csp-header.md.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${outfit.variable} h-full antialiased`}
    >
      <head>
        {/*
         * Migrate the legacy next-themes localStorage namespace
         * (`theme`) to the project-scoped one (`serenify-theme`)
         * introduced in feature 003. Runs synchronously during initial
         * HTML parse — before any React code and before next-themes'
         * own FOUT-prevention script reads storage — so users carrying
         * the pre-migration key see no flash on first load.
         * Idempotent: re-runs on every load but no-ops once migrated.
         * Carries the CSP nonce (script-src 'nonce-…'). `suppressHydrationWarning`
         * is required: per the CSP spec the browser strips a script's `nonce`
         * content attribute once the policy is applied (anti-exfiltration), so
         * the SSR'd `nonce="…"` reads back as `nonce=""` at hydration — an
         * unavoidable, benign attribute mismatch React would otherwise warn on.
         * next-themes does the same on its own nonced FOUC <script>.
         */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var l=localStorage.getItem('theme');if(l){localStorage.setItem('serenify-theme',l);localStorage.removeItem('theme');}}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <CrossTabAuth />
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
