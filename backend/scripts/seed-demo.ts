/**
 * Precarga el marketplace de la demo: registra los 4 XML de /samples como facturas de la wallet "pyme".
 * Requiere .env generado por scripts/setup-testnet.sh (PYME_SECRET, ORACLE_SECRET, CONTRACT_ID, DEBTOR_PUBLIC).
 * Uso: cd backend && npm run seed
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { clpToStroops, dueDateToUnix } from "../src/amounts.js";
import { loadConfig } from "../src/config.js";
import { parseDte } from "../src/dte/parser.js";
import { Oracle } from "../src/stellar/oracle.js";

const config = loadConfig();
const pymeSecret = process.env.PYME_SECRET;
if (!pymeSecret) throw new Error("Falta PYME_SECRET en .env (lo escribe scripts/setup-testnet.sh)");
const pyme = Keypair.fromSecret(pymeSecret);

const oracle = new Oracle({
  rpcUrl: config.STELLAR_RPC_URL,
  networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  contractId: config.CONTRACT_ID,
  oracleSecret: config.ORACLE_SECRET,
});

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "samples");
const DISCOUNTS = [400, 500, 600, 800]; // varía el rendimiento para que el marketplace se vea real

let i = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".xml")).sort()) {
  const dte = parseDte(readFileSync(join(dir, file), "utf8"));
  const bps = DISCOUNTS[i++ % DISCOUNTS.length];
  try {
    const xdr = await oracle.prepareRegister({
      issuer: pyme.publicKey(),
      debtor: config.DEBTOR_PUBLIC,
      invoiceHashHex: dte.invoiceHash,
      faceValue: clpToStroops(dte.montoTotal, config.CLP_PER_USD),
      dueDate: dueDateToUnix(dte.fechaVencimiento),
      discountBps: bps,
    });
    const tx = TransactionBuilder.fromXDR(xdr, config.STELLAR_NETWORK_PASSPHRASE);
    tx.sign(pyme);
    const res = await oracle.submit(tx.toXDR());
    console.log(`✅ ${file}: factura #${res.invoiceId} (${bps / 100}% descuento) tx ${res.txHash}`);
  } catch (e) {
    console.log(`⚠️  ${file}: ${(e as Error).message}`);
  }
}
