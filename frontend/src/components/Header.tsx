"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { explorerContract, formatUsdct, shortAddr } from "@/lib/format";
import { Button } from "./ui";

const NAV = [
  { href: "/pyme", label: "Pyme" },
  { href: "/inversionista", label: "Inversionista" },
  { href: "/deudor", label: "Deudor" },
];

export function Header() {
  const { address, balance, config, connect, disconnect } = useApp();
  const path = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-brand-700">
          CobraFi
        </Link>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Testnet</span>
        <nav className="flex gap-1 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3 py-1.5 font-medium ${
                path.startsWith(n.href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {config && (
            <a href={explorerContract(config.contractId)} target="_blank" rel="noreferrer" className="hidden text-xs text-slate-500 underline sm:inline">
              Contrato ↗
            </a>
          )}
          {address ? (
            <>
              <span className="text-right leading-tight">
                <span className="block font-mono text-xs">{shortAddr(address)}</span>
                {balance !== null && <span className="block text-xs text-slate-500">{formatUsdct(balance, config?.assetCode)}</span>}
              </span>
              <Button variant="secondary" onClick={disconnect}>
                Salir
              </Button>
            </>
          ) : (
            <Button onClick={() => connect().catch((e) => alert(e.message))}>Conectar wallet</Button>
          )}
        </div>
      </div>
    </header>
  );
}
