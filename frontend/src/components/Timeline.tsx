"use client";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
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
    return <p className="text-sm text-muted">Aún no hay eventos on-chain para esta factura.</p>;
  }
  const sorted = [...events].sort((a, b) => a.closedAt.localeCompare(b.closedAt));
  return (
    <ol className="relative ml-2 space-y-4 border-l border-line pl-6">
      {sorted.map((ev, i) => (
        <motion.li key={`${ev.txHash}-${ev.name}`} className="relative" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
          <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-brand ring-4 ring-surface" />
          <p className="text-sm font-semibold">{LABEL[ev.name] ?? ev.name}</p>
          <p className="text-xs text-muted">
            {new Date(ev.closedAt).toLocaleString("es-CL")} · {detail(ev)}
          </p>
          <a href={explorerTx(ev.txHash)} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-soft hover:underline">
            Ver en stellar.expert <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </motion.li>
      ))}
    </ol>
  );
}
