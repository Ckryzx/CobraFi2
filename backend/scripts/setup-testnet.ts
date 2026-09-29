/**
 * CobraFi — despliegue a testnet con el SDK de JavaScript:
 * cuentas demo (Friendbot), token USDCt + SAC, contrato invoice_factoring y su inicialización.
 * Escribe direcciones y claves de TESTNET en ../.env. Reutiliza cuentas y token si ya existen en .env.
 * Uso: ./scripts/setup-testnet.sh   (compila el wasm y llama a este script)
 */
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENV_PATH = join(ROOT, ".env");
const WASM = join(ROOT, "target/wasm32v1-none/release/invoice_factoring.wasm");
const RPC_URL = process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const FRIENDBOT = process.env.FRIENDBOT_URL ?? "https://friendbot.stellar.org";
const PASS = Networks.TESTNET;
const ASSET_CODE = "USDCt";
const STROOPS = 10_000_000n;

const server = new rpc.Server(RPC_URL);
const log = (m: string) => console.log(m);

function readEnv(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}

const prev = readEnv();
const ROLES = ["ASSET_ISSUER", "ADMIN", "ORACLE", "PYME", "INVESTOR", "DEBTOR"] as const;
const keys = {} as Record<(typeof ROLES)[number], Keypair>;
const created = new Set<string>();
for (const r of ROLES) {
  const saved = prev[`${r}_SECRET`];
  if (saved) keys[r] = Keypair.fromSecret(saved);
  else {
    keys[r] = Keypair.random();
    created.add(r);
  }
}

async function waitFor(hash: string) {
  for (let i = 0; i < 60; i++) {
    const res = await server.getTransaction(hash);
    if (res.status === "SUCCESS") return res;
    if (res.status === "FAILED") throw new Error(`Transacción ${hash} falló: ${res.resultXdr?.toXDR("base64") ?? ""}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Tiempo de espera agotado para ${hash}`);
}

async function submit(tx: Transaction, signer: Keypair) {
  tx.sign(signer);
  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") throw new Error(`Rechazada: ${sent.errorResult?.toXDR("base64") ?? "sin detalle"}`);
  return waitFor(sent.hash);
}

async function build(source: Keypair, op: xdr.Operation) {
  const account = await server.getAccount(source.publicKey());
  return new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASS }).addOperation(op).setTimeout(120).build();
}

/** Operación clásica (trustline, pago). */
const classic = async (source: Keypair, op: xdr.Operation) => submit(await build(source, op), source);

/** Operación Soroban: simula/prepara antes de firmar. */
async function soroban(source: Keypair, op: xdr.Operation) {
  const prepared = await server.prepareTransaction(await build(source, op));
  return submit(prepared, source);
}

async function fund(kp: Keypair) {
  try {
    await server.getAccount(kp.publicKey());
    return; // ya existe
  } catch {}
  const res = await fetch(`${FRIENDBOT}/?addr=${kp.publicKey()}`);
  if (!res.ok) throw new Error(`Friendbot respondió ${res.status} para ${kp.publicKey()}`);
  for (let i = 0; i < 20; i++) {
    try {
      await server.getAccount(kp.publicKey());
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`La cuenta ${kp.publicKey()} no apareció tras Friendbot`);
}

async function main() {
  if (!existsSync(WASM)) throw new Error(`Falta ${WASM}. Compila con: stellar contract build`);

  log("==> Cuentas (Friendbot)");
  for (const r of ROLES) {
    await fund(keys[r]);
    log(`  ${r.padEnd(12)} ${keys[r].publicKey()}${created.has(r) ? " (nueva)" : ""}`);
  }

  const asset = new Asset(ASSET_CODE, keys.ASSET_ISSUER.publicKey());
  log(`==> Trustlines de ${ASSET_CODE}`);
  for (const r of ["PYME", "INVESTOR", "DEBTOR"] as const) {
    await classic(keys[r], Operation.changeTrust({ asset }));
    log(`  ${r}: OK`);
  }

  log("==> Reparto de saldo (solo cuentas nuevas)");
  const amounts = { INVESTOR: 50_000n, DEBTOR: 50_000n, PYME: 10n } as const;
  for (const r of ["INVESTOR", "DEBTOR", "PYME"] as const) {
    if (!created.has(r)) continue;
    const amount = (amounts[r] * STROOPS).toString();
    await classic(
      keys.ASSET_ISSUER,
      Operation.payment({ destination: keys[r].publicKey(), asset, amount: (Number(amounts[r])).toFixed(7) }),
    );
    log(`  ${r} <- ${amounts[r]} ${ASSET_CODE} (${amount} stroops)`);
  }

  log("==> Stellar Asset Contract (SAC)");
  const tokenId = asset.contractId(PASS);
  try {
    await soroban(keys.ASSET_ISSUER, Operation.createStellarAssetContract({ asset }));
    log(`  SAC creado: ${tokenId}`);
  } catch (e) {
    log(`  SAC ya existía o no se pudo crear (${(e as Error).message.slice(0, 80)}); se usa ${tokenId}`);
  }

  log("==> Despliegue del contrato");
  const wasm = readFileSync(WASM);
  const upload = await soroban(keys.ADMIN, Operation.uploadContractWasm({ wasm }));
  const wasmHash = Buffer.from(scValToNative(upload.returnValue!) as Uint8Array);
  const create = await soroban(
    keys.ADMIN,
    Operation.createCustomContract({
      address: new Address(keys.ADMIN.publicKey()),
      wasmHash,
      salt: randomBytes(32),
    }),
  );
  const contractId = String(scValToNative(create.returnValue!));
  log(`  Contrato: ${contractId}`);

  log("==> initialize(admin, oracle, token)");
  await soroban(
    keys.ADMIN,
    new Contract(contractId).call(
      "initialize",
      new Address(keys.ADMIN.publicKey()).toScVal(),
      new Address(keys.ORACLE.publicKey()).toScVal(),
      new Address(tokenId).toScVal(),
    ),
  );
  log("  OK");

  const env: Record<string, string> = {
    STELLAR_RPC_URL: RPC_URL,
    STELLAR_NETWORK_PASSPHRASE: `"${PASS}"`,
    CONTRACT_ID: contractId,
    TOKEN_CONTRACT_ID: tokenId,
    ASSET_CODE,
    ASSET_ISSUER: keys.ASSET_ISSUER.publicKey(),
    ORACLE_SECRET: keys.ORACLE.secret(),
    DEBTOR_PUBLIC: keys.DEBTOR.publicKey(),
  };
  for (const r of ROLES) {
    env[`${r}_PUBLIC`] = keys[r].publicKey();
    env[`${r}_SECRET`] = keys[r].secret();
  }
  writeFileSync(ENV_PATH, Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  chmodSync(ENV_PATH, 0o600);

  log(`\nListo. Contrato: https://stellar.expert/explorer/testnet/contract/${contractId}`);
  log(`Token USDCt (SAC): ${tokenId}`);
  log("Claves de testnet guardadas en .env (ignorado por git).");
}

main().catch((e) => {
  console.error("\n❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
