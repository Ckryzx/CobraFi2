"use client";

import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { parseInvoice, prepareInvoice, submitInvoice } from "@/lib/api";
import { friendlyError } from "@/lib/contract";
import {
  annualizedYield,
  explorerTx,
  formatClp,
  formatDate,
  formatPercent,
  formatUsdct,
  fundingAmount,
  shortHash,
} from "@/lib/format";
import type { ParseResult } from "@/lib/types";
import { InvoiceCard } from "@/components/InvoiceCard";
import { Alert, Button, Card, ConnectPrompt, Field } from "@/components/ui";

const SAMPLES = [
  ["factura_panaderia.xml", "Panadería — $4,76 M"],
  ["factura_ferreteria.xml", "Ferretería — $11,9 M"],
  ["factura_transportes.xml", "Transportes — $2,38 M"],
  ["factura_vinedos.xml", "Viñedos — $8,9 M"],
];

export default function PymePage() {
  const { address, connect, config, invoices, refresh, sign } = useApp();
  const [xml, setXml] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [bps, setBps] = useState(500);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ txHash: string; invoiceId: number } | null>(null);

  const mine = invoices.filter((i) => i.issuer === address);
  const code = config?.assetCode ?? "USDCt";

  async function load(text: string) {
    setError(null);
    setDone(null);
    setParsed(null);
    setXml(text);
    setBusy("Leyendo factura…");
    try {
      setParsed(await parseInvoice(text));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onFile(f: File | undefined) {
    if (f) await load(await f.text());
  }

  async function loadSample(name: string) {
    const res = await fetch(`/samples/${name}`);
    await load(await res.text());
  }

  async function register() {
    if (!xml || !address || !config) return;
    setError(null);
    setDone(null);
    try {
      setBusy("El oráculo está atestiguando la factura…");
      const prep = await prepareInvoice(xml, address, bps);
      setBusy("Firma la transacción en Freighter…");
      const signed = await sign(prep.xdr, prep.networkPassphrase);
      setBusy("Registrando en la blockchain…");
      const res = await submitInvoice(signed);
      setDone(res);
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const face = parsed ? BigInt(parsed.faceValueStroops) : 0n;
  const receive = fundingAmount(face, bps);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Pyme: financia tu factura</h1>
        <p className="text-sm text-slate-600">Sube el XML de tu factura electrónica (DTE tipo 33) y recibe el dinero al instante.</p>
      </div>

      {!address && <ConnectPrompt onConnect={() => connect().catch((e) => setError(e.message))} />}

      <Card className="space-y-4">
        <h2 className="font-semibold">1. Sube tu factura</h2>
        <input
          type="file"
          accept=".xml,text/xml,application/xml"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700"
        />
        <div className="text-xs text-slate-500">
          o prueba con un ejemplo:{" "}
          {SAMPLES.map(([f, label]) => (
            <button key={f} onClick={() => loadSample(f)} className="mr-2 underline hover:text-brand-700">
              {label}
            </button>
          ))}
        </div>
      </Card>

      {busy && <Alert kind="info">{busy}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      {parsed && (
        <Card className="space-y-4">
          <h2 className="font-semibold">2. Revisa los datos extraídos</h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Folio" value={parsed.dte.folio} />
            <Field label="RUT emisor" value={parsed.dte.rutEmisor} />
            <Field label="RUT receptor (deudor)" value={parsed.dte.rutReceptor} />
            <Field label="Monto total" value={`${formatClp(parsed.dte.montoTotal)} ≈ ${formatUsdct(face, code)}`} />
            <Field label="Emisión" value={parsed.dte.fechaEmision} />
            <Field label="Vencimiento" value={formatDate(parsed.dueDate)} />
            <Field label="Hash (on-chain)" value={<span className="font-mono text-xs">{shortHash(parsed.dte.invoiceHash, 8)}</span>} />
            <Field
              label="Validación SII (simulada)"
              value={parsed.validation.valid ? "✅ Válida" : `❌ ${parsed.validation.reason ?? "No válida"}`}
            />
            <Field label="Deudor en directorio" value={parsed.debtorFound ? "✅ Sí" : "❌ No registrado"} />
          </dl>
        </Card>
      )}

      {parsed && parsed.validation.valid && parsed.debtorFound && (
        <Card className="space-y-4">
          <h2 className="font-semibold">3. Elige tu descuento</h2>
          <label className="block text-sm">
            Descuento: <strong>{(bps / 100).toFixed(1)}%</strong>
            <input
              type="range"
              min={100}
              max={2000}
              step={50}
              value={bps}
              onChange={(e) => setBps(Number(e.target.value))}
              className="mt-2 w-full accent-emerald-600"
            />
          </label>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Recibes hoy" value={<span className="text-lg font-bold text-brand-700">{formatUsdct(receive, code)}</span>} />
            <Field label="Costo del adelanto" value={formatUsdct(face - receive, code)} />
            <Field label="Rend. anual para el inversionista" value={formatPercent(annualizedYield(face, bps, parsed.dueDate))} />
          </div>
          {address ? (
            <Button onClick={register} disabled={!!busy}>
              Registrar factura
            </Button>
          ) : (
            <p className="text-sm text-slate-500">Conecta tu wallet para registrar.</p>
          )}
        </Card>
      )}

      {done && (
        <Alert kind="ok">
          ¡Factura #{done.invoiceId} registrada! Recibirás {code} en cuanto un inversionista la financie.{" "}
          <a className="underline" href={explorerTx(done.txHash)} target="_blank" rel="noreferrer">
            Ver transacción ↗
          </a>
        </Alert>
      )}

      {address && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Mis facturas</h2>
          {mine.length === 0 ? (
            <p className="text-sm text-slate-500">Todavía no has registrado facturas con esta wallet.</p>
          ) : (
            mine.map((i) => <InvoiceCard key={i.id} invoice={i} />)
          )}
        </section>
      )}
    </div>
  );
}
