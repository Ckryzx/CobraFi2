"use client";

import { ExternalLink, Landmark, LogOut, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { explorerContract, formatUsdct, shortAddr } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui";

const NAV = [
  { href: "/pyme", label: "Pyme" },
  { href: "/inversionista", label: "Inversionista" },
  { href: "/deudor", label: "Deudor" },
];

export function Header() {
  const { address, balance, config, configError, connect, disconnect } = useApp();
  const path = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-soft to-brand text-brand-ink shadow-[0_0_18px_rgb(245_158_11/0.4)]">
            <Landmark className="h-4 w-4" aria-hidden />
          </span>
          <span className="font-display text-2xl">
            Cobra<span className="text-brand-soft">Fi</span>
          </span>
        </Link>
        <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-soft ring-1 ring-inset ring-brand/30">Testnet</span>

        <nav className="relative flex gap-1 text-sm" aria-label="Principal">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={cn("relative rounded-lg px-3 py-1.5 font-medium transition-colors", active ? "text-ink" : "text-muted hover:text-ink")}>
                {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-ink/10 ring-1 ring-inset ring-ink/10" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                <span className="relative">{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <ThemeToggle />
          {config && (
            <a href={explorerContract(config.contractId)} target="_blank" rel="noreferrer" className="hidden items-center gap-1 text-xs text-muted transition-colors hover:text-ink sm:inline-flex">
              Contrato <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
          {address ? (
            <>
              <span className="rounded-xl border border-line bg-ink/5 px-3 py-1.5 text-right leading-tight">
                <span className="block font-mono text-xs">{shortAddr(address)}</span>
                {balance !== null && <span className="block text-xs font-medium text-brand-soft">{formatUsdct(balance, config?.assetCode)}</span>}
              </span>
              <Button variant="secondary" onClick={disconnect} aria-label="Desconectar wallet">
                <LogOut className="h-4 w-4" aria-hidden />
                Salir
              </Button>
            </>
          ) : (
            <Button onClick={() => connect().catch((e) => alert(e.message))}>
              <Wallet className="h-4 w-4" aria-hidden />
              Conectar wallet
            </Button>
          )}
        </div>
      </div>
      {configError && (
        <div role="alert" className="border-t border-danger/30 bg-danger/10 px-4 py-2 text-center text-xs text-rose-200">
          {configError}
        </div>
      )}
    </header>
  );
}
