import type { ParsedDte } from "../dte/parser.js";
import type { InvoiceValidator, ValidationResult } from "./types.js";

/**
 * Validador SIMULADO para la hackatón: no consulta al SII.
 * - modo permisivo (por defecto): acepta cualquier DTE tipo 33 estructuralmente válido.
 * - modo estricto: solo acepta los hashes de los XML de ejemplo (`allowedHashes`).
 */
export class MockSiiValidator implements InvoiceValidator {
  readonly country = "CL";
  constructor(private readonly allowedHashes?: ReadonlySet<string>) {}

  async validate(dte: ParsedDte): Promise<ValidationResult> {
    if (dte.tipoDTE !== 33) return { valid: false, reason: "Tipo de DTE no soportado" };
    if (this.allowedHashes && !this.allowedHashes.has(dte.invoiceHash)) {
      return { valid: false, reason: "DTE no reconocido por el SII (validación simulada, modo estricto)" };
    }
    return { valid: true };
  }
}
