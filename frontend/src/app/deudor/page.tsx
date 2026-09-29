"use client";

import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { friendlyError, invokeAsSource } from "@/lib/contract";
import { explorerTx } from "@/lib/format";
import { InvoiceCard } from "@/components/InvoiceCard";
import { Alert, Button, ConnectPrompt } from "@/components/ui";

export default function DeudorPage() {
  const { address, connect, config, invoices, refresh, sign, dataError } = useApp();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okTx, setOkTx] = useState<string | null>(null);

  const mine = invoices.filter((i) => i.debtor === address);
  const toPay = mine.filter((i) => i.status === "Funded");
  const waiting = mine.filter((i) => i.status === "Registered");
  const history = mine.filter((i) => i.status === "Repaid" || i.status === "Defaulted");

  async function pay(id: number) {
    if (!address || !config) return;
    setError(null);
    setOkTx(null);
    setBusyId(id);
    try {
      const hash = await invokeAsSource(config, address, "repay", id, sign);
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
      <div>
        <h1 className="text-2xl font-bold">Deudor: facturas por pagar</h1>
        <p className="text-sm text-slate-600">El pago va directo al inversionista que financió la factura.</p>
      </div>

      {!address && <ConnectPrompt onConnect={() => connect().catch((e) => setError(e.message))} />}
      {error && <Alert kind="error">{error}</Alert>}
      {dataError && <Alert kind="error">No se pudo leer el contrato: {dataError}</Alert>}
      {okTx && (
        <Alert kind="ok">
          ¡Pago realizado! La factura quedó saldada.{" "}
          <a className="underline" href={explorerTx(okTx)} target="_blank" rel="noreferrer">
            Ver transacción ↗
          </a>
        </Alert>
      )}

      {address && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Por pagar ({toPay.length})</h2>
            {toPay.length === 0 ? (
              <p className="text-sm text-slate-500">No tienes facturas pendientes con esta wallet.</p>
            ) : (
              toPay.map((i) => (
                <InvoiceCard
                  key={i.id}
                  invoice={i}
                  actions={
                    <Button onClick={() => pay(i.id)} disabled={busyId !== null}>
                      {busyId === i.id ? "Pagando…" : "Pagar factura"}
                    </Button>
                  }
                />
              ))
            )}
          </section>
          {waiting.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Registradas, aún sin financiar ({waiting.length})</h2>
              <p className="text-sm text-slate-500">Todavía no hay nada que pagar: se habilita cuando un inversionista las financie.</p>
              {waiting.map((i) => (
                <InvoiceCard key={i.id} invoice={i} />
              ))}
            </section>
          )}
          {history.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Historial</h2>
              {history.map((i) => (
                <InvoiceCard key={i.id} invoice={i} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
