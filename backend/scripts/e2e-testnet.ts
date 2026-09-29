/**
 * Prueba de humo del ciclo completo contra la testnet (usa las cuentas de ../.env):
 * doble registro, fund, doble fund, repay por un tercero, repay del deudor, mora antes de tiempo y eventos.
 * Uso: cd backend && npm run e2e:testnet   (requiere haber corrido setup-testnet y seed)
 */
import { Address, BASE_FEE, Contract, Keypair, TransactionBuilder, nativeToScVal, rpc, scValToNative } from "@stellar/stellar-sdk";
import { loadConfig } from "../src/config.js";

const c = loadConfig();
const server = new rpc.Server(c.STELLAR_RPC_URL);
const kp = (name: string) => Keypair.fromSecret(process.env[`${name}_SECRET`]!);
const [pyme, investor, debtor] = [kp("PYME"), kp("INVESTOR"), kp("DEBTOR")];
const tokenId = c.TOKEN_CONTRACT_ID;
let failed = 0;

const u32 = (n: number) => nativeToScVal(n, { type: "u32" });

async function call(contractId: string, source: Keypair, method: string, args: any[]) {
  const account = await server.getAccount(source.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: c.STELLAR_NETWORK_PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(120)
    .build();
  const prepared = await server.prepareTransaction(tx); // falla si la simulación revierte
  prepared.sign(source);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error("rechazada");
  for (let i = 0; i < 60; i++) {
    const r = await server.getTransaction(sent.hash);
    if (r.status === "SUCCESS") return r;
    if (r.status === "FAILED") throw new Error("falló en red");
    await new Promise((x) => setTimeout(x, 1000));
  }
  throw new Error("timeout");
}

async function read(contractId: string, method: string, args: any[]) {
  const account = await server.getAccount(pyme.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: c.STELLAR_NETWORK_PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return scValToNative((sim as rpc.Api.SimulateTransactionSuccessResponse).result!.retval);
}

const balance = async (k: Keypair) => BigInt(await read(tokenId, "balance", [new Address(k.publicKey()).toScVal()]));
const status = async (id: number) => (await read(c.CONTRACT_ID, "get_invoice", [u32(id)])).status[0] as string;

function check(name: string, ok: boolean, extra = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
}

async function expectError(name: string, code: number, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(name, false, "no falló");
  } catch (e) {
    const msg = (e as Error).message;
    check(name, msg.includes(`#${code}`), msg.includes(`#${code}`) ? `Error(Contract, #${code})` : msg.slice(0, 120));
  }
}

const ID = Number(process.env.E2E_INVOICE_ID ?? 1);
const OTHER = Number(process.env.E2E_OTHER_ID ?? 2);

const inv = await read(c.CONTRACT_ID, "get_invoice", [u32(ID)]);
console.log(`Factura #${ID}: estado ${inv.status[0]}, valor ${inv.face_value}, descuento ${inv.discount_bps} bps\n`);
const price = (BigInt(inv.face_value) * BigInt(10_000 - Number(inv.discount_bps))) / 10_000n;

if (inv.status[0] === "Registered") {
  const [p0, i0] = [await balance(pyme), await balance(investor)];
  await call(c.CONTRACT_ID, investor, "fund", [u32(ID), new Address(investor.publicKey()).toScVal()]);
  const [p1, i1] = [await balance(pyme), await balance(investor)];
  check("fund: estado Funded", (await status(ID)) === "Funded");
  check("fund: la pyme recibió el precio con descuento", p1 - p0 === price, `${p1 - p0} = ${price}`);
  check("fund: el inversionista pagó exactamente ese monto", i0 - i1 === price);
}
await expectError("fund doble rechazado (#8)", 8, () => call(c.CONTRACT_ID, investor, "fund", [u32(ID), new Address(investor.publicKey()).toScVal()]));
await expectError("repay por un tercero rechazado (#12)", 12, () => call(c.CONTRACT_ID, investor, "repay", [u32(ID), new Address(investor.publicKey()).toScVal()]));
await expectError("mark_default antes del vencimiento (#9)", 9, () => call(c.CONTRACT_ID, pyme, "mark_default", [u32(ID)]));

if ((await status(ID)) === "Funded") {
  const i2 = await balance(investor);
  await call(c.CONTRACT_ID, debtor, "repay", [u32(ID), new Address(debtor.publicKey()).toScVal()]);
  check("repay del deudor: estado Repaid", (await status(ID)) === "Repaid");
  check("repay: el inversionista cobró el valor completo", (await balance(investor)) - i2 === BigInt(inv.face_value));
}
await expectError("repay doble rechazado (#8)", 8, () => call(c.CONTRACT_ID, debtor, "repay", [u32(ID), new Address(debtor.publicKey()).toScVal()]));
console.log(`Factura #${OTHER} sigue: ${await status(OTHER)}`);

const latest = await server.getLatestLedger();
const ev = await server.getEvents({ startLedger: latest.sequence - 5000, filters: [{ type: "contract", contractIds: [c.CONTRACT_ID] }], limit: 200 });
const names = ev.events.map((e) => `${scValToNative(e.topic[0])}#${scValToNative(e.topic[1])}`);
console.log("Eventos:", names.join(", "));
check("eventos on-chain emitidos", names.some((n) => n.startsWith("invoice_registered")) && names.includes(`invoice_funded#${ID}`) && names.includes(`invoice_repaid#${ID}`));

console.log(failed ? `\n${failed} verificación(es) fallaron` : "\nTodo OK");
process.exit(failed ? 1 : 0);
