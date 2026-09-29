/** Utilidades para RUT chileno (módulo 11). */

/** Normaliza a formato "12345678-K": sin puntos, DV en mayúscula. */
export function normalizeRut(input: string): string {
  const clean = input.replace(/[.\s]/g, "").toUpperCase();
  const m = /^(\d{1,8})-?([\dK])$/.exec(clean);
  if (!m) throw new Error(`RUT con formato inválido: "${input}"`);
  return `${Number(m[1])}-${m[2]}`;
}

export function computeDv(body: number): string {
  let sum = 0;
  let mul = 2;
  for (const d of String(body).split("").reverse()) {
    sum += Number(d) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (sum % 11);
  return r === 11 ? "0" : r === 10 ? "K" : String(r);
}

export function isValidRut(input: string): boolean {
  try {
    const [body, dv] = normalizeRut(input).split("-");
    return computeDv(Number(body)) === dv;
  } catch {
    return false;
  }
}
