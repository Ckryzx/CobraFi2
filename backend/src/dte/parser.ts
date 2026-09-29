import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { isValidRut, normalizeRut } from "./rut.js";

export interface ParsedDte {
  tipoDTE: number;
  folio: number;
  rutEmisor: string;
  rutReceptor: string;
  /** Monto total en CLP (entero). */
  montoTotal: number;
  /** ISO yyyy-mm-dd */
  fechaEmision: string;
  /** ISO yyyy-mm-dd */
  fechaVencimiento: string;
  /** sha256(rutEmisor|tipoDTE|folio) en hex: identifica la factura sin exponer datos. */
  invoiceHash: string;
}

export class DteParseError extends Error {}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false, // mantenemos strings: los RUT y folios no deben perder ceros ni formato
  trimValues: true,
  processEntities: false, // sin expansión de entidades (evita XXE / billion laughs)
});

/** Busca el primer nodo `key` a cualquier profundidad (soporta <DTE> y <EnvioDTE>). */
function find(node: unknown, key: string): any {
  if (node === null || typeof node !== "object") return undefined;
  const obj = node as Record<string, unknown>;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    const hit = Array.isArray(v) ? v.map((x) => find(x, key)).find(Boolean) : find(v, key);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

function text(node: unknown, key: string, label: string): string {
  const v = find(node, key);
  if (v === undefined || v === null || typeof v === "object" || String(v).trim() === "") {
    throw new DteParseError(`Falta el campo ${label} (${key}) en el DTE`);
  }
  return String(v).trim();
}

function isoDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new DteParseError(`${label} inválida: "${value}" (se espera yyyy-mm-dd)`);
  }
  return value;
}

export function computeInvoiceHash(rutEmisor: string, tipoDTE: number, folio: number): string {
  return createHash("sha256").update(`${rutEmisor}|${tipoDTE}|${folio}`).digest("hex");
}

/** Extrae los datos de una factura electrónica (tipo 33) desde el XML del DTE. */
export function parseDte(xml: string): ParsedDte {
  if (!xml || xml.length > 1_000_000) throw new DteParseError("XML vacío o demasiado grande");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new DteParseError("El XML no puede contener DOCTYPE/ENTITY");

  let tree: unknown;
  try {
    tree = parser.parse(xml);
  } catch (e) {
    throw new DteParseError(`XML mal formado: ${(e as Error).message}`);
  }
  const doc = find(tree, "Documento");
  if (!doc) throw new DteParseError("No se encontró <Documento> en el XML");

  const tipoDTE = Number(text(doc, "TipoDTE", "tipo de DTE"));
  if (tipoDTE !== 33) throw new DteParseError(`Solo se soporta factura electrónica (tipo 33), recibido ${tipoDTE}`);

  const folio = Number(text(doc, "Folio", "folio"));
  if (!Number.isInteger(folio) || folio <= 0) throw new DteParseError("Folio inválido");

  const rutEmisorRaw = text(doc, "RUTEmisor", "RUT emisor");
  const rutReceptorRaw = text(doc, "RUTRecep", "RUT receptor");
  if (!isValidRut(rutEmisorRaw)) throw new DteParseError(`RUT emisor inválido: ${rutEmisorRaw}`);
  if (!isValidRut(rutReceptorRaw)) throw new DteParseError(`RUT receptor inválido: ${rutReceptorRaw}`);
  const rutEmisor = normalizeRut(rutEmisorRaw);
  const rutReceptor = normalizeRut(rutReceptorRaw);

  const montoTotal = Number(text(doc, "MntTotal", "monto total"));
  if (!Number.isInteger(montoTotal) || montoTotal <= 0) throw new DteParseError("Monto total inválido");

  const fechaEmision = isoDate(text(doc, "FchEmis", "fecha de emisión"), "Fecha de emisión");
  const fechaVencimiento = isoDate(text(doc, "FchVenc", "fecha de vencimiento"), "Fecha de vencimiento");
  if (fechaVencimiento < fechaEmision) throw new DteParseError("El vencimiento es anterior a la emisión");

  return {
    tipoDTE,
    folio,
    rutEmisor,
    rutReceptor,
    montoTotal,
    fechaEmision,
    fechaVencimiento,
    invoiceHash: computeInvoiceHash(rutEmisor, tipoDTE, folio),
  };
}
