"use client";

import { ThemeProvider } from "next-themes";

export function Providers({
  children,
  nonce,
}: {
  children: React.ReactNode;
  // Per-request CSP nonce, threaded from the root layout. next-themes applies
  // it to its injected FOUC <script> and transition <style> (0.4.6+).
  nonce?: string;
}) {
  return (
    <ThemeProvider
      nonce={nonce}
      attribute="class"
      storageKey="serenify-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
