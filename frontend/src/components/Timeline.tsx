"use client";

import { explorerTx, formatUsdct, shortAddr } from "@/lib/format";
import type { ContractEvent } from "@/lib/types";

const LABEL: Record<string, string> = {
  invoice_registered: "Factura registrada",
  invoice_funded: "Financiada por un inversionista",
  invoice_repaid: "Pagada por el deudor",
  invoice_defaulted: "Marcada en mora",
};

function detail(ev: ContractEvent): string {
  const d = ev.data as Record<string, any>;
  switch (ev.name) {
    case "invoice_registered":
      return `Emisor ${shortAddr(String(d.issuer))} · valor ${formatUsdct(BigInt(d.face_value))}`;
    case "invoice_funded":
      return `Inversionista ${shortAddr(String(d.investor))} entregó ${formatUsdct(BigInt(d.amount))} al emisor`;
    case "invoice_repaid":
      return `Deudor ${shortAddr(String(d.payer))} pagó ${formatUsdct(BigInt(d.amount))} al inversionista`;
    default:
      return "";
  }
}

export function Timeline({ events }: { events: ContractEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">Aún no hay eventos on-chain para esta factura.</p>;
  }
  const sorted = [...events].sort((a, b) => a.closedAt.localeCompare(b.closedAt));
  return (
    <ol className="relative ml-2 space-y-3 border-l border-slate-200 pl-5">
      {sorted.map((ev) => (
        <li key={`${ev.txHash}-${ev.name}`} className="relative">
          <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-white" />
          <p className="text-sm font-semibold">{LABEL[ev.name] ?? ev.name}</p>
          <p className="text-xs text-slate-500">
            {new Date(ev.closedAt).toLocaleString("es-CL")} · {detail(ev)}
          </p>
          <a
            href={explorerTx(ev.txHash)}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-brand-700 underline"
          >
            Ver en stellar.expert ↗
          </a>
        </li>
      ))}
    </ol>
  );
}
