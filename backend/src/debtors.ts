import { normalizeRut } from "./dte/rut.js";

/**
 * Traduce el RUT receptor del DTE a la dirección Stellar que podrá pagar la factura.
 * En producción esto lo atestiguaría un registro de identidades del oráculo; en la demo es un mapa fijo.
 */
export interface DebtorDirectory {
  lookup(rutReceptor: string): string | undefined;
}

export class StaticDebtorDirectory implements DebtorDirectory {
  private readonly map = new Map<string, string>();
  constructor(entries: Record<string, string>) {
    for (const [rut, addr] of Object.entries(entries)) this.map.set(normalizeRut(rut), addr);
  }
  lookup(rutReceptor: string): string | undefined {
    return this.map.get(normalizeRut(rutReceptor));
  }
}
