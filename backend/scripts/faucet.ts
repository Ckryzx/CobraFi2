/**
 * Recarga USDCt a una cuenta demo desde el emisor del token (útil antes de la demo).
 * Uso: cd backend && npm run faucet -- INVESTOR 40000     (roles: PYME | INVESTOR | DEBTOR)
 */
import { Asset, BASE_FEE, Keypair, Operation, TransactionBuilder, rpc } from "@stellar/stellar-sdk";
import { loadConfig } from "../src/config.js";

const [role, amountArg] = process.argv.slice(2);
const c = loadConfig();
const dest = process.env[`${role}_PUBLIC`];
const issuerSecret = process.env.ASSET_ISSUER_SECRET;
if (!dest || !issuerSecret || !/^\d+(\.\d+)?$/.test(amountArg ?? "")) {
  console.error("Uso: npm run faucet -- <PYME|INVESTOR|DEBTOR> <monto USDCt>");
  process.exit(1);
}
const issuer = Keypair.fromSecret(issuerSecret);
const server = new rpc.Server(c.STELLAR_RPC_URL);
const tx = new TransactionBuilder(await server.getAccount(issuer.publicKey()), {
  fee: BASE_FEE,
  networkPassphrase: c.STELLAR_NETWORK_PASSPHRASE,
})
  .addOperation(Operation.payment({ destination: dest, asset: new Asset(c.ASSET_CODE, issuer.publicKey()), amount: amountArg }))
  .setTimeout(60)
  .build();
tx.sign(issuer);
const sent = await server.sendTransaction(tx);
for (let i = 0; i < 30; i++) {
  const r = await server.getTransaction(sent.hash);
  if (r.status === "SUCCESS") {
    console.log(`✅ ${role} recibió ${amountArg} ${c.ASSET_CODE} (tx ${sent.hash})`);
    process.exit(0);
  }
  if (r.status === "FAILED") break;
  await new Promise((x) => setTimeout(x, 1000));
}
console.error("❌ No se pudo completar el pago");
process.exit(1);
