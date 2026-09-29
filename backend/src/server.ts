import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { StaticDebtorDirectory } from "./debtors.js";
import { parseDte } from "./dte/parser.js";
import { Oracle } from "./stellar/oracle.js";
import { MockSiiValidator } from "./validator/mockSii.js";

const config = loadConfig();

// Modo estricto: solo los hashes de /samples.
let allowed: Set<string> | undefined;
if (config.MOCK_SII_STRICT === "true") {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "samples");
  allowed = new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith(".xml"))
      .map((f) => parseDte(readFileSync(join(dir, f), "utf8")).invoiceHash),
  );
}

const oracle = new Oracle({
  rpcUrl: config.STELLAR_RPC_URL,
  networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  contractId: config.CONTRACT_ID,
  oracleSecret: config.ORACLE_SECRET,
});

const app = createApp({
  config,
  oracle,
  validator: new MockSiiValidator(allowed),
  debtors: new StaticDebtorDirectory({ [config.DEMO_DEBTOR_RUT]: config.DEBTOR_PUBLIC }),
});

app.listen(config.PORT, () => {
  console.log(`CobraFi backend en http://localhost:${config.PORT} (oráculo ${oracle.publicKey})`);
});
