import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "CobraFi — Factoring de facturas sobre Stellar",
  description: "Financia tus facturas electrónicas al instante con stablecoins sobre Stellar/Soroban.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <Providers>
          <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-brand-ink">
            Saltar al contenido
          </a>
          <Header />
          <main id="contenido" className="mx-auto max-w-5xl px-4 py-10">
            {children}
          </main>
          <footer className="mx-auto max-w-5xl px-4 pb-12 text-xs text-muted">
            Demo en Stellar Testnet, sin valor real. Los datos personales nunca se guardan on-chain: solo el hash del DTE y los montos.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
