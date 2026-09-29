import express from "express";
import cors from "cors";
import { StrKey } from "@stellar/stellar-sdk";
import { z } from "zod";
import type { Config } from "./config.js";
import { clpToStroops, dueDateToUnix } from "./amounts.js";
import { DteParseError, parseDte, type ParsedDte } from "./dte/parser.js";
import type { DebtorDirectory } from "./debtors.js";
import type { InvoiceValidator } from "./validator/types.js";
import { OracleError } from "./stellar/oracle.js";

/** Lo que el servidor necesita del oráculo (facilita testear sin red). */
export interface OraclePort {
  readonly publicKey: string;
  prepareRegister(p: {
    issuer: string;
    debtor: string;
    invoiceHashHex: string;
    faceValue: bigint;
    dueDate: number;
    discountBps: number;
  }): Promise<string>;
  submit(txXdr: string): Promise<{ txHash: string; invoiceId: number }>;
}

export interface Deps {
  config: Config;
  oracle: OraclePort;
  validator: InvoiceValidator;
  debtors: DebtorDirectory;
}

const xmlBody = z.object({ xml: z.string().min(1) });
const prepareBody = xmlBody.extend({
  issuer: z.string().refine((s) => StrKey.isValidEd25519PublicKey(s), "Dirección del emisor inválida"),
  discountBps: z.number().int().min(1).max(5000),
});
const submitBody = z.object({ xdr: z.string().min(1) });

export function createApp(deps: Deps) {
  const { config, oracle, validator, debtors } = deps;
  const app = express();
  app.use(cors({ origin: config.CORS_ORIGIN.split(",") }));
  app.use(express.json({ limit: "1mb" }));

  async function analyze(xml: string) {
    const dte = parseDte(xml);
    const validation = await validator.validate(dte);
    const debtor = debtors.lookup(dte.rutReceptor);
    return { dte, validation, debtor, ...preview(dte) };
  }

  function preview(dte: ParsedDte) {
    const faceValue = clpToStroops(dte.montoTotal, config.CLP_PER_USD);
    return { faceValueStroops: faceValue.toString(), dueDate: dueDateToUnix(dte.fechaVencimiento) };
  }

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/config", (_req, res) => {
    res.json({
      network: config.STELLAR_NETWORK_PASSPHRASE,
      rpcUrl: config.STELLAR_RPC_URL,
      contractId: config.CONTRACT_ID,
      tokenContractId: config.TOKEN_CONTRACT_ID,
      assetCode: config.ASSET_CODE,
      assetIssuer: config.ASSET_ISSUER,
      oraclePublicKey: oracle.publicKey,
      clpPerUsd: config.CLP_PER_USD,
      validator: { country: validator.country },
    });
  });

  // Extrae y valida los datos del DTE (no toca la blockchain).
  app.post("/invoices/parse", async (req, res, next) => {
    try {
      const { xml } = xmlBody.parse(req.body);
      const a = await analyze(xml);
      res.json({
        dte: a.dte,
        validation: a.validation,
        debtorFound: a.debtor !== undefined,
        faceValueStroops: a.faceValueStroops,
        dueDate: a.dueDate,
      });
    } catch (e) {
      next(e);
    }
  });

  // Si la factura es válida, arma la tx register_invoice con la autorización del oráculo ya firmada.
  app.post("/invoices/prepare", async (req, res, next) => {
    try {
      const body = prepareBody.parse(req.body);
      const a = await analyze(body.xml);
      if (!a.validation.valid) {
        res.status(422).json({ error: a.validation.reason ?? "Factura no válida" });
        return;
      }
      if (!a.debtor) {
        res.status(422).json({ error: `No hay una dirección Stellar registrada para el RUT receptor ${a.dte.rutReceptor}` });
        return;
      }
      const xdr = await oracle.prepareRegister({
        issuer: body.issuer,
        debtor: a.debtor,
        invoiceHashHex: a.dte.invoiceHash,
        faceValue: BigInt(a.faceValueStroops),
        dueDate: a.dueDate,
        discountBps: body.discountBps,
      });
      res.json({
        xdr,
        networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
        summary: {
          invoiceHash: a.dte.invoiceHash,
          folio: a.dte.folio,
          faceValueStroops: a.faceValueStroops,
          dueDate: a.dueDate,
          discountBps: body.discountBps,
          debtor: a.debtor,
        },
      });
    } catch (e) {
      next(e);
    }
  });

  // Recibe la tx firmada por el emisor (wallet) y la envía a la red.
  app.post("/invoices/submit", async (req, res, next) => {
    try {
      const { xdr } = submitBody.parse(req.body);
      res.json(await oracle.submit(xdr));
    } catch (e) {
      next(e);
    }
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Solicitud inválida", details: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
    } else if (err instanceof DteParseError || err instanceof OracleError) {
      res.status(422).json({ error: err.message });
    } else {
      console.error(err);
      res.status(500).json({ error: "Error interno" });
    }
  });

  return app;
}
