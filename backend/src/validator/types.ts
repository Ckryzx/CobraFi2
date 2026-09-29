import type { ParsedDte } from "../dte/parser.js";

export interface ValidationResult {
  valid: boolean;
  /** Motivo si no es válida. */
  reason?: string;
}

/**
 * Punto de extensión: valida que la factura exista y sea legítima en la autoridad tributaria.
 * Hoy: MockSiiValidator (Chile). Roadmap: SiiValidator real, CFDI (México), NF-e (Brasil).
 */
export interface InvoiceValidator {
  readonly country: string;
  validate(dte: ParsedDte): Promise<ValidationResult>;
}
