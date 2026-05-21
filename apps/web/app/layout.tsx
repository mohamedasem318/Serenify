import type { Metadata } from "next";
import { Inter, DM_Serif_Display } from "next/font/google";
import { CrossTabAuth } from "@/components/cross-tab-auth";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Serenify",
  description: "Workplace stress, gently noticed.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${dmSerifDisplay.variable} h-full antialiased`}
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
         */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var l=localStorage.getItem('theme');if(l){localStorage.setItem('serenify-theme',l);localStorage.removeItem('theme');}}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <CrossTabAuth />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
