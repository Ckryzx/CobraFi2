"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, TrendingUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/cn";
import {
  annualizedYield,
  daysUntil,
  formatClp,
  formatDate,
  formatPercent,
  formatUsdct,
  fundingAmount,
  shortHash,
  stroopsToClp,
} from "@/lib/format";
import type { Invoice } from "@/lib/types";
import { Field, StatusBadge } from "./ui";
import { Timeline } from "./Timeline";

const STEPS: { key: Invoice["status"]; label: string }[] = [
  { key: "Registered", label: "Registrada" },
  { key: "Funded", label: "Financiada" },
  { key: "Repaid", label: "Pagada" },
];

/** Indicador de avance: registrada → financiada → pagada. */
function Stepper({ status }: { status: Invoice["status"] }) {
  const current = status === "Defaulted" ? 1 : STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="flex items-center gap-2" aria-label="Avance de la factura">
      {STEPS.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full transition-colors", done ? (status === "Defaulted" && i === 1 ? "bg-danger" : "bg-brand-soft") : "bg-white/15")} />
            <span className={cn("text-[11px]", done ? "text-ink" : "text-muted")}>{s.label}</span>
            {i < STEPS.length - 1 && <span className={cn("h-px w-6", i < current ? "bg-brand-soft/60" : "bg-white/15")} />}
          </li>
        );
      })}
    </ol>
  );
}

export function InvoiceCard({ invoice, actions }: { invoice: Invoice; actions?: ReactNode }) {
  const { config, events } = useApp();
  const [open, setOpen] = useState(false);
  const code = config?.assetCode ?? "USDCt";
  const clp = config ? stroopsToClp(invoice.faceValue, config.clpPerUsd) : null;
  const days = daysUntil(invoice.dueDate);
  const price = fundingAmount(invoice.faceValue, invoice.discountBps);
  const own = events.filter((e) => e.invoiceId === invoice.id);
  const yieldPct = annualizedYield(invoice.faceValue, invoice.discountBps, invoice.dueDate);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-line bg-surface/80 p-5 shadow-[0_8px_30px_rgb(0_0_0/0.25)] backdrop-blur-md transition-colors hover:border-white/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">
            Factura #{invoice.id} · hash <span className="font-mono">{shortHash(invoice.invoiceHash, 6)}</span>
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{formatUsdct(invoice.faceValue, code)}</p>
          {clp !== null && <p className="text-xs text-muted">≈ {formatClp(clp)}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={invoice.status} />
          <Stepper status={invoice.status} />
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Vence" value={`${formatDate(invoice.dueDate)}${days > 0 ? ` (${days} d)` : ""}`} />
        <Field label="Descuento" value={`${(invoice.discountBps / 100).toFixed(1)}%`} />
        <Field label="Precio de compra" value={formatUsdct(price, code)} />
        <Field
          label="Rend. anualizado"
          accent={invoice.status === "Registered" ? "gold" : undefined}
          value={
            invoice.status === "Registered" ? (
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                {formatPercent(yieldPct)}
              </span>
            ) : (
              "—"
            )
          }
        />
      </dl>

      {actions && <div className="mt-5">{actions}</div>}

      <button onClick={() => setOpen(!open)} aria-expanded={open} className="mt-5 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-brand-soft hover:underline">
        {open ? "Ocultar línea de tiempo" : "Ver línea de tiempo"}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-4">
              <Timeline events={own} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
