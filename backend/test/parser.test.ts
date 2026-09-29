import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DteParseError, parseDte } from "../src/dte/parser.js";
import { computeDv, isValidRut, normalizeRut } from "../src/dte/rut.js";

const samplesDir = join(import.meta.dirname, "..", "samples");
const sample = (f: string) => readFileSync(join(samplesDir, f), "utf8");

describe("RUT", () => {
  it("valida dígito verificador", () => {
    expect(isValidRut("96.500.100-K")).toBe(true);
    expect(isValidRut("96500100-K")).toBe(true);
    expect(isValidRut("96.500.100-1")).toBe(false);
    expect(isValidRut("abc")).toBe(false);
    expect(computeDv(12345678)).toBe("5");
  });
  it("normaliza", () => {
    expect(normalizeRut("76.543.210-3")).toBe("76543210-3");
    expect(normalizeRut("96.500.100-k")).toBe("96500100-K");
  });
});

describe("parseDte", () => {
  it("parsea la factura de ejemplo", () => {
    const d = parseDte(sample("factura_panaderia.xml"));
    expect(d.tipoDTE).toBe(33);
    expect(d.folio).toBe(1523);
    expect(d.montoTotal).toBe(4760000);
    expect(d.fechaVencimiento).toBe("2026-12-10");
    expect(d.rutReceptor).toBe("96500100-K");
    const expected = createHash("sha256").update(`${d.rutEmisor}|33|1523`).digest("hex");
    expect(d.invoiceHash).toBe(expected);
  });

  it("los 4 ejemplos son válidos y tienen hashes distintos", () => {
    const files = readdirSync(samplesDir).filter((f) => f.endsWith(".xml"));
    expect(files.length).toBe(4);
    const hashes = new Set(files.map((f) => parseDte(sample(f)).invoiceHash));
    expect(hashes.size).toBe(4);
  });

  it("el hash no expone datos y es determinista", () => {
    const a = parseDte(sample("factura_ferreteria.xml"));
    const b = parseDte(sample("factura_ferreteria.xml"));
    expect(a.invoiceHash).toBe(b.invoiceHash);
    expect(a.invoiceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rechaza tipos distintos de 33", () => {
    expect(() => parseDte(sample("factura_panaderia.xml").replace("<TipoDTE>33", "<TipoDTE>34"))).toThrow(/tipo 33/);
  });
  it("rechaza RUT con dígito verificador incorrecto", () => {
    expect(() => parseDte(sample("factura_panaderia.xml").replace("96.500.100-K", "96.500.100-1"))).toThrow(DteParseError);
  });
  it("rechaza monto inválido y campos faltantes", () => {
    expect(() => parseDte(sample("factura_panaderia.xml").replace("<MntTotal>4760000", "<MntTotal>-5"))).toThrow(/Monto/);
    expect(() => parseDte(sample("factura_panaderia.xml").replace(/<Folio>.*<\/Folio>/, ""))).toThrow(/folio/i);
  });
  it("rechaza XML vacío, mal formado y con DOCTYPE/ENTITY", () => {
    expect(() => parseDte("")).toThrow(DteParseError);
    expect(() => parseDte("<DTE><Documento>")).toThrow(DteParseError);
    const xxe = '<?xml version="1.0"?><!DOCTYPE d [<!ENTITY x SYSTEM "file:///etc/passwd">]><DTE><Documento>&x;</Documento></DTE>';
    expect(() => parseDte(xxe)).toThrow(/DOCTYPE/);
  });
  it("rechaza vencimiento anterior a la emisión", () => {
    expect(() => parseDte(sample("factura_panaderia.xml").replace("<FchVenc>2026-12-10", "<FchVenc>2026-01-01"))).toThrow(/anterior/);
  });
});
