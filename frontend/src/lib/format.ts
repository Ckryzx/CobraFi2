import type { Invoice } from "./types";

const STROOPS = 10_000_000n;

/** stroops -> número (para mostrar; 7 decimales caben en un double para montos de demo). */
export function stroopsToNumber(v: bigint): number {
  return Number(v) / Number(STROOPS);
}

export function formatUsdct(v: bigint, code = "USDCt"): string {
  return `${stroopsToNumber(v).toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code}`;
}

export function formatClp(clp: number): string {
  return clp.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

/** Equivalente aproximado en CLP de un monto en stroops. */
export function stroopsToClp(v: bigint, clpPerUsd: number): number {
  return Math.round(stroopsToNumber(v) * clpPerUsd);
}

/** Lo que recibe el emisor: face * (10000 - bps) / 10000 (misma fórmula entera del contrato). */
export function fundingAmount(face: bigint, discountBps: number): bigint {
  return (face * BigInt(10_000 - discountBps)) / 10_000n;
}

export function daysUntil(dueUnix: number, nowMs = Date.now()): number {
  return Math.ceil((dueUnix * 1000 - nowMs) / 86_400_000);
}

/** Rendimiento anualizado simple del inversionista: (face/precio - 1) * 365 / días. */
export function annualizedYield(face: bigint, discountBps: number, dueUnix: number, nowMs = Date.now()): number {
  const days = daysUntil(dueUnix, nowMs);
  if (days <= 0) return 0;
  const price = fundingAmount(face, discountBps);
  if (price <= 0n) return 0;
  const gross = Number(face) / Number(price) - 1;
  return (gross * 365) / days;
}

export function formatPercent(x: number): string {
  return `${(x * 100).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export function shortHash(hex: string, n = 8): string {
  return hex.length <= n * 2 ? hex : `${hex.slice(0, n)}…${hex.slice(-n)}`;
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export const STATUS_LABEL: Record<Invoice["status"], string> = {
  Registered: "Registrada",
  Funded: "Financiada",
  Repaid: "Pagada",
  Defaulted: "En mora",
};

export const explorerTx = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;
export const explorerContract = (id: string) => `https://stellar.expert/explorer/testnet/contract/${id}`;
