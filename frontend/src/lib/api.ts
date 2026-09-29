import type { AppConfig, ParseResult } from "./types";

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8787";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BACKEND_URL + path, init);
  } catch {
    throw new Error(`No se pudo conectar con el backend (${BACKEND_URL}). ¿Está corriendo?`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
  return body as T;
}

const post = <T,>(path: string, body: unknown) =>
  call<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const getConfig = () => call<AppConfig>("/config");
export const parseInvoice = (xml: string) => post<ParseResult>("/invoices/parse", { xml });
export const prepareInvoice = (xml: string, issuer: string, discountBps: number) =>
  post<{ xdr: string; networkPassphrase: string }>("/invoices/prepare", { xml, issuer, discountBps });
export const submitInvoice = (xdr: string) => post<{ txHash: string; invoiceId: number }>("/invoices/submit", { xdr });
