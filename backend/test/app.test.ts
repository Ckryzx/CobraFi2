import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { createApp, type OraclePort } from "../src/app.js";
import { clpToStroops, dueDateToUnix } from "../src/amounts.js";
import { loadConfig } from "../src/config.js";
import { StaticDebtorDirectory } from "../src/debtors.js";
import { parseDte } from "../src/dte/parser.js";
import { MockSiiValidator } from "../src/validator/mockSii.js";

const sample = (f: string) => readFileSync(join(import.meta.dirname, "..", "samples", f), "utf8");
const debtorKey = Keypair.random().publicKey();
const issuerKey = Keypair.random().publicKey();

const calls: any[] = [];
const oracle: OraclePort = {
  publicKey: Keypair.random().publicKey(),
  async prepareRegister(p) {
    calls.push(p);
    return "FAKE_XDR";
  },
  async submit() {
    return { txHash: "abc", invoiceId: 1 };
  },
};

const config = loadConfig({
  CONTRACT_ID: "C_TEST",
  ORACLE_SECRET: Keypair.random().secret(),
  DEBTOR_PUBLIC: debtorKey,
} as NodeJS.ProcessEnv);

let base = "";
let close: () => void;

function start(validator = new MockSiiValidator()) {
  const app = createApp({ config, oracle, validator, debtors: new StaticDebtorDirectory({ "96.500.100-K": debtorKey }) });
  return new Promise<void>((resolve) => {
    const srv = app.listen(0, () => {
      base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
      close = () => srv.close();
      resolve();
    });
  });
}

const post = (path: string, body: unknown) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("amounts", () => {
  it("convierte CLP a stroops", () => {
    expect(clpToStroops(950_000, 950)).toBe(10_000_000_000n); // 1000 USDCt
    expect(clpToStroops(4_760_000, 950)).toBe(50_105_263_157n);
    expect(() => clpToStroops(0, 950)).toThrow();
  });
  it("convierte fecha a unix al final del día en Chile", () => {
    expect(dueDateToUnix("2026-12-10")).toBe(Date.parse("2026-12-10T23:59:59-03:00") / 1000);
  });
});

describe("API", () => {
  beforeAll(() => start());
  afterAll(() => close());

  it("GET /config", async () => {
    const j = await (await fetch(base + "/config")).json();
    expect(j.contractId).toBe("C_TEST");
    expect(j.assetCode).toBe("USDCt");
    expect(JSON.stringify(j)).not.toMatch(/secret/i);
  });

  it("POST /invoices/parse", async () => {
    const r = await post("/invoices/parse", { xml: sample("factura_panaderia.xml") });
    const j = await r.json();
    expect(r.status).toBe(200);
    expect(j.validation.valid).toBe(true);
    expect(j.debtorFound).toBe(true);
    expect(j.dte.invoiceHash).toBe(parseDte(sample("factura_panaderia.xml")).invoiceHash);
    expect(j.faceValueStroops).toBe("50105263157");
  });

  it("parse con XML inválido -> 422", async () => {
    const r = await post("/invoices/parse", { xml: "<x/>" });
    expect(r.status).toBe(422);
  });

  it("parse sin cuerpo -> 400", async () => {
    expect((await post("/invoices/parse", {})).status).toBe(400);
  });

  it("POST /invoices/prepare arma la tx con deudor, hash y monto correctos", async () => {
    calls.length = 0;
    const r = await post("/invoices/prepare", { xml: sample("factura_panaderia.xml"), issuer: issuerKey, discountBps: 500 });
    const j = await r.json();
    expect(r.status).toBe(200);
    expect(j.xdr).toBe("FAKE_XDR");
    expect(calls[0].debtor).toBe(debtorKey);
    expect(calls[0].issuer).toBe(issuerKey);
    expect(calls[0].discountBps).toBe(500);
    expect(calls[0].invoiceHashHex).toBe(parseDte(sample("factura_panaderia.xml")).invoiceHash);
    expect(calls[0].faceValue).toBe(50105263157n);
  });

  it("prepare rechaza emisor inválido y descuento fuera de rango", async () => {
    const xml = sample("factura_panaderia.xml");
    expect((await post("/invoices/prepare", { xml, issuer: "nope", discountBps: 500 })).status).toBe(400);
    expect((await post("/invoices/prepare", { xml, issuer: issuerKey, discountBps: 9000 })).status).toBe(400);
    expect((await post("/invoices/prepare", { xml, issuer: issuerKey, discountBps: 0 })).status).toBe(400);
  });

  it("prepare rechaza si el receptor no tiene dirección registrada", async () => {
    calls.length = 0;
    const xml = sample("factura_panaderia.xml").replace("96.500.100-K", "76.543.210-3");
    const r = await post("/invoices/prepare", { xml, issuer: issuerKey, discountBps: 500 });
    expect(r.status).toBe(422);
    expect(calls).toHaveLength(0);
  });

  it("POST /invoices/submit", async () => {
    const j = await (await post("/invoices/submit", { xdr: "X" })).json();
    expect(j).toEqual({ txHash: "abc", invoiceId: 1 });
  });
});

describe("modo estricto del validador simulado", () => {
  afterAll(() => close());
  it("rechaza un DTE que no es de ejemplo y el oráculo no firma", async () => {
    const allowed = new Set([parseDte(sample("factura_panaderia.xml")).invoiceHash]);
    await start(new MockSiiValidator(allowed));
    calls.length = 0;
    const otro = sample("factura_ferreteria.xml");
    const r = await post("/invoices/prepare", { xml: otro, issuer: issuerKey, discountBps: 500 });
    expect(r.status).toBe(422);
    expect(calls).toHaveLength(0);
    const ok = await post("/invoices/prepare", { xml: sample("factura_panaderia.xml"), issuer: issuerKey, discountBps: 500 });
    expect(ok.status).toBe(200);
  });
});
