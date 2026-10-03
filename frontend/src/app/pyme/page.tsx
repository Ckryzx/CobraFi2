"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ExternalLink, FileCode2, UploadCloud, XCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useApp } from "@/lib/app-context";
import { parseInvoice, prepareInvoice, submitInvoice } from "@/lib/api";
import { friendlyError } from "@/lib/contract";
import { cn } from "@/lib/cn";
import { annualizedYield, explorerTx, formatClp, formatDate, formatPercent, formatUsdct, fundingAmount, shortHash } from "@/lib/format";
import type { ParseResult } from "@/lib/types";
import { InvoiceCard } from "@/components/InvoiceCard";
import { Alert, Button, Card, ConnectPrompt, EmptyState, Field, InvoiceSkeleton, SectionTitle } from "@/components/ui";

const SAMPLES = [
  ["factura_panaderia.xml", "Panadería — $4,76 M"],
  ["factura_ferreteria.xml", "Ferretería — $11,9 M"],
  ["factura_transportes.xml", "Transportes — $2,38 M"],
  ["factura_vinedos.xml", "Viñedos — $8,9 M"],
];

function StepTitle({ n, children }: { n: number; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-base font-semibold">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand/15 text-sm font-bold text-brand-soft">{n}</span>
      {children}
    </h2>
  );
}

const Reveal = ({ children }: { children: ReactNode }) => (
  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
    {children}
  </motion.div>
);

export default function PymePage() {
  const { address, connect, config, invoices, refresh, sign, loading } = useApp();
  const [xml, setXml] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [bps, setBps] = useState(500);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ txHash: string; invoiceId: number } | null>(null);
  const [drag, setDrag] = useState(false);

  const mine = invoices.filter((i) => i.issuer === address);
  const code = config?.assetCode ?? "USDCt";

  async function load(text: string, name: string) {
    setError(null);
    setDone(null);
    setParsed(null);
    setXml(text);
    setFileName(name);
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
    if (f) await load(await f.text(), f.name);
  }

  async function loadSample(name: string) {
    const res = await fetch(`/samples/${name}`);
    await load(await res.text(), name);
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
  const canRegister = parsed && parsed.validation.valid && parsed.debtorFound;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pyme: financia tu factura</h1>
        <p className="mt-1 text-sm text-muted">Sube el XML de tu factura electrónica (DTE tipo 33) y recibe el dinero al instante.</p>
      </div>

      {!address && <ConnectPrompt onConnect={() => connect().catch((e) => setError(e.message))} />}

      <Card className="space-y-4">
        <StepTitle n={1}>Sube tu factura</StepTitle>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:border-brand-soft",
            drag ? "border-brand bg-brand/10" : "border-line hover:border-brand/60 hover:bg-white/5",
          )}
        >
          <input type="file" accept=".xml,text/xml,application/xml" onChange={(e) => onFile(e.target.files?.[0])} className="sr-only" />
          {fileName ? <FileCode2 className="h-7 w-7 text-brand-soft" aria-hidden /> : <UploadCloud className="h-7 w-7 text-muted" aria-hidden />}
          <span className="text-sm font-medium">{fileName ?? "Arrastra tu XML aquí o haz clic para elegirlo"}</span>
          <span className="text-xs text-muted">Factura electrónica del SII, tipo 33</span>
        </label>
        <div className="text-xs text-muted">
          o prueba con un ejemplo:{" "}
          {SAMPLES.map(([f, label]) => (
            <button key={f} onClick={() => loadSample(f)} className="mr-3 cursor-pointer underline decoration-white/30 underline-offset-2 transition-colors hover:text-brand-soft">
              {label}
            </button>
          ))}
        </div>
      </Card>

      {busy && <Alert kind="info">{busy}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      <AnimatePresence>
        {parsed && (
          <Reveal key="datos">
            <Card className="space-y-4">
              <StepTitle n={2}>Revisa los datos extraídos</StepTitle>
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
                  value={
                    parsed.validation.valid ? (
                      <span className="inline-flex items-center gap-1.5 text-brand-soft"><CheckCircle2 className="h-4 w-4" aria-hidden /> Válida</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-danger"><XCircle className="h-4 w-4" aria-hidden /> {parsed.validation.reason ?? "No válida"}</span>
                    )
                  }
                />
                <Field
                  label="Deudor en directorio"
                  value={
                    parsed.debtorFound ? (
                      <span className="inline-flex items-center gap-1.5 text-brand-soft"><CheckCircle2 className="h-4 w-4" aria-hidden /> Sí</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-danger"><XCircle className="h-4 w-4" aria-hidden /> No registrado</span>
                    )
                  }
                />
              </dl>
            </Card>
          </Reveal>
        )}

        {canRegister && (
          <Reveal key="descuento">
            <Card className="space-y-5">
              <StepTitle n={3}>Elige tu descuento</StepTitle>
              <label className="block text-sm">
                Descuento: <strong className="text-brand-soft">{(bps / 100).toFixed(1)}%</strong>
                <input type="range" min={100} max={2000} step={50} value={bps} onChange={(e) => setBps(Number(e.target.value))} className="mt-3 w-full cursor-pointer" />
              </label>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Recibes hoy" accent="brand" value={<span className="text-xl font-bold">{formatUsdct(receive, code)}</span>} />
                <Field label="Costo del adelanto" value={formatUsdct(face - receive, code)} />
                <Field label="Rend. anual para el inversionista" accent="gold" value={formatPercent(annualizedYield(face, bps, parsed.dueDate))} />
              </div>
              {address ? (
                <Button onClick={register} disabled={!!busy}>
                  Registrar factura
                </Button>
              ) : (
                <p className="text-sm text-muted">Conecta tu wallet para registrar.</p>
              )}
            </Card>
          </Reveal>
        )}
      </AnimatePresence>

      {done && (
        <Alert kind="ok">
          ¡Factura #{done.invoiceId} registrada! Recibirás {code} en cuanto un inversionista la financie.{" "}
          <a className="inline-flex items-center gap-1 underline" href={explorerTx(done.txHash)} target="_blank" rel="noreferrer">
            Ver transacción <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </Alert>
      )}

      {address && (
        <section className="space-y-3">
          <SectionTitle count={mine.length}>Mis facturas</SectionTitle>
          {loading && invoices.length === 0 ? (
            <InvoiceSkeleton />
          ) : mine.length === 0 ? (
            <EmptyState>Todavía no has registrado facturas con esta wallet.</EmptyState>
          ) : (
            mine.map((i) => <InvoiceCard key={i.id} invoice={i} />)
          )}
        </section>
      )}
    </div>
  );
}
