const STROOPS_PER_TOKEN = 10_000_000n;

/** CLP -> stroops de USDCt (7 decimales) con aritmética entera. `clpPerUsd` admite 2 decimales. */
export function clpToStroops(clp: number, clpPerUsd: number): bigint {
  if (!Number.isInteger(clp) || clp <= 0) throw new Error("Monto CLP inválido");
  const rateCents = BigInt(Math.round(clpPerUsd * 100));
  if (rateCents <= 0n) throw new Error("Tipo de cambio inválido");
  return (BigInt(clp) * STROOPS_PER_TOKEN * 100n) / rateCents;
}

/** Fecha yyyy-mm-dd -> timestamp unix (s) al final de ese día en hora de Chile (UTC-3). */
export function dueDateToUnix(isoDate: string): number {
  return Math.floor(Date.parse(`${isoDate}T23:59:59-03:00`) / 1000);
}
