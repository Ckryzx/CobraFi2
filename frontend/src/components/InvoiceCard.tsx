"use client";

import { useState, type ReactNode } from "react";
import { useApp } from "@/lib/app-context";
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
import { StatusBadge, Field } from "./ui";
import { Timeline } from "./Timeline";

export function InvoiceCard({ invoice, actions }: { invoice: Invoice; actions?: ReactNode }) {
  const { config, events } = useApp();
  const [open, setOpen] = useState(false);
  const code = config?.assetCode ?? "USDCt";
  const clp = config ? stroopsToClp(invoice.faceValue, config.clpPerUsd) : null;
  const days = daysUntil(invoice.dueDate);
  const price = fundingAmount(invoice.faceValue, invoice.discountBps);
  const own = events.filter((e) => e.invoiceId === invoice.id);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500">Factura #{invoice.id} · hash {shortHash(invoice.invoiceHash, 6)}</p>
          <p className="text-2xl font-bold">{formatUsdct(invoice.faceValue, code)}</p>
          {clp !== null && <p className="text-xs text-slate-500">≈ {formatClp(clp)}</p>}
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Vence" value={`${formatDate(invoice.dueDate)}${days > 0 ? ` (${days} d)` : ""}`} />
        <Field label="Descuento" value={`${(invoice.discountBps / 100).toFixed(1)}%`} />
        <Field label="Precio de compra" value={formatUsdct(price, code)} />
        <Field
          label="Rend. anualizado"
          value={invoice.status === "Registered" ? formatPercent(annualizedYield(invoice.faceValue, invoice.discountBps, invoice.dueDate)) : "—"}
        />
      </dl>

      {actions && <div className="mt-4">{actions}</div>}

      <button onClick={() => setOpen(!open)} className="mt-4 text-xs font-medium text-brand-700 underline">
        {open ? "Ocultar línea de tiempo" : "Ver línea de tiempo"}
      </button>
      {open && (
        <div className="mt-3">
          <Timeline events={own} />
        </div>
      )}
    </div>
  );
}
