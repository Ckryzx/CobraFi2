import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProvider } from "@/lib/app-context";
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
        <AppProvider>
          <Header />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-slate-500">
            Demo en Stellar Testnet — sin valor real. Los datos personales nunca se guardan on-chain: solo el hash del DTE y montos.
          </footer>
        </AppProvider>
      </body>
    </html>
  );
}
