"use client";

import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { friendlyError, invokeAsSource } from "@/lib/contract";
import { explorerTx, formatUsdct, fundingAmount } from "@/lib/format";
import { InvoiceCard } from "@/components/InvoiceCard";
import { Alert, Button, ConnectPrompt } from "@/components/ui";

export default function InversionistaPage() {
  const { address, balance, connect, config, invoices, refresh, sign, loading, dataError } = useApp();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okTx, setOkTx] = useState<string | null>(null);

  const now = Date.now() / 1000;
  const open = invoices.filter((i) => i.status === "Registered" && i.dueDate > now);
  const mine = invoices.filter((i) => i.investor === address);

  async function fund(id: number) {
    if (!address || !config) return;
    setError(null);
    setOkTx(null);
    const inv = invoices.find((i) => i.id === id);
    if (inv && balance !== null) {
      const price = fundingAmount(inv.faceValue, inv.discountBps);
      if (balance < price) {
        setError(`Saldo insuficiente: necesitas ${formatUsdct(price, config.assetCode)} y tienes ${formatUsdct(balance, config.assetCode)}.`);
        return;
      }
    }
    setBusyId(id);
    try {
      const hash = await invokeAsSource(config, address, "fund", id, sign);
      setOkTx(hash);
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Inversionista: marketplace de facturas</h1>
          <p className="text-sm text-slate-600">Compra facturas con descuento y cobra el valor completo al vencimiento.</p>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={loading}>
          {loading ? "Actualizando…" : "Actualizar"}
        </Button>
      </div>

      {!address && <ConnectPrompt onConnect={() => connect().catch((e) => setError(e.message))} />}
      {error && <Alert kind="error">{error}</Alert>}
      {dataError && <Alert kind="error">No se pudo leer el contrato: {dataError}</Alert>}
      {okTx && (
        <Alert kind="ok">
          ¡Factura financiada! El emisor ya recibió los fondos.{" "}
          <a className="underline" href={explorerTx(okTx)} target="_blank" rel="noreferrer">
            Ver transacción ↗
          </a>
        </Alert>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Facturas abiertas ({open.length})</h2>
        {open.length === 0 ? (
          <p className="text-sm text-slate-500">No hay facturas abiertas por ahora.</p>
        ) : (
          open.map((i) => (
            <InvoiceCard
              key={i.id}
              invoice={i}
              actions={
                <Button onClick={() => fund(i.id)} disabled={!address || busyId !== null}>
                  {busyId === i.id ? "Financiando…" : "Financiar"}
                </Button>
              }
            />
          ))
        )}
      </section>

      {address && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Mis inversiones ({mine.length})</h2>
          {mine.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no has financiado facturas con esta wallet.</p>
          ) : (
            mine.map((i) => <InvoiceCard key={i.id} invoice={i} />)
          )}
        </section>
      )}
    </div>
  );
}
