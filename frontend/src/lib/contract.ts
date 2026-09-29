import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import type { AppConfig, ContractEvent, Invoice, InvoiceStatus } from "./types";

/** Firma un XDR de transacción con la wallet (Freighter). */
export type Signer = (xdr: string, networkPassphrase: string) => Promise<string>;


/** Cuenta ficticia válida para simular lecturas (la simulación no exige que exista). */
const DUMMY_ACCOUNT = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI";

export function makeServer(cfg: AppConfig): rpc.Server {
  return new rpc.Server(cfg.rpcUrl, { allowHttp: cfg.rpcUrl.startsWith("http://") });
}

async function simulateRead(cfg: AppConfig, contractId: string, method: string, args: xdr.ScVal[], source?: string) {
  const server = makeServer(cfg);
  const tx = new TransactionBuilder(new Account(source ?? DUMMY_ACCOUNT, "0"), {
    fee: BASE_FEE,
    networkPassphrase: cfg.network,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!("result" in sim) || !sim.result) throw new Error("Simulación sin resultado");
  return scValToNative(sim.result.retval);
}

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** Convierte el struct `Invoice` del contrato (ya nativo) al tipo de la UI. */
export function toInvoice(raw: any): Invoice {
  const status = (Array.isArray(raw.status) ? raw.status[0] : raw.status) as InvoiceStatus;
  return {
    id: Number(raw.id),
    issuer: String(raw.issuer),
    debtor: String(raw.debtor),
    invoiceHash: toHex(raw.invoice_hash),
    faceValue: BigInt(raw.face_value),
    dueDate: Number(raw.due_date),
    discountBps: Number(raw.discount_bps),
    status,
    investor: raw.investor ? String(raw.investor) : null,
  };
}

export async function fetchInvoices(cfg: AppConfig): Promise<Invoice[]> {
  const count = Number(await simulateRead(cfg, cfg.contractId, "invoice_count", []));
  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const raws = await Promise.all(
    ids.map((id) => simulateRead(cfg, cfg.contractId, "get_invoice", [nativeToScVal(id, { type: "u32" })])),
  );
  return raws.map(toInvoice).sort((a, b) => b.id - a.id);
}

export async function fetchBalance(cfg: AppConfig, address: string): Promise<bigint> {
  if (!cfg.tokenContractId) return 0n;
  const v = await simulateRead(cfg, cfg.tokenContractId, "balance", [new Address(address).toScVal()]);
  return BigInt(v);
}

const EVENT_NAMES = new Set(["invoice_registered", "invoice_funded", "invoice_repaid", "invoice_defaulted"]);

export async function fetchEvents(cfg: AppConfig): Promise<ContractEvent[]> {
  const server = makeServer(cfg);
  const latest = await server.getLatestLedger();
  const startLedger = Math.max(latest.sequence - 100_000, 1); // ~5,7 días, dentro de la retención del RPC
  const res = await server.getEvents({
    startLedger,
    filters: [{ type: "contract", contractIds: [cfg.contractId] }],
    limit: 200,
  });
  const out: ContractEvent[] = [];
  for (const ev of res.events) {
    const topics = ev.topic.map((t) => scValToNative(t));
    const name = String(topics[0]);
    if (!EVENT_NAMES.has(name)) continue;
    out.push({
      name,
      invoiceId: Number(topics[1]),
      txHash: ev.txHash,
      closedAt: ev.ledgerClosedAt,
      data: (scValToNative(ev.value) ?? {}) as Record<string, unknown>,
    });
  }
  return out;
}

/** Espera a que la red confirme la tx. */
async function waitForTx(server: rpc.Server, hash: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const res = await server.getTransaction(hash);
    if (res.status === "SUCCESS") return;
    if (res.status === "FAILED") throw new Error("La transacción falló en la red");
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Tiempo de espera agotado. Revisa la transacción ${hash}`);
}

const CONTRACT_ERRORS: Record<number, string> = {
  3: "Esta factura ya fue registrada (anti doble-cesión)",
  8: "La factura no está en el estado correcto para esta operación",
  9: "La factura aún no vence",
  10: "La factura ya venció",
  12: "Solo el deudor registrado puede pagar esta factura",
};

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const m = /Error\(Contract, #(\d+)\)/.exec(msg);
  if (m) return CONTRACT_ERRORS[Number(m[1])] ?? `Error del contrato #${m[1]}`;
  if (/trustline|op_no_trust|trust/i.test(msg)) return "Tu cuenta necesita una trustline del token (USDCt)";
  if (/balance|insufficient/i.test(msg)) return "Saldo insuficiente de USDCt";
  return msg;
}

/**
 * Construye, simula, hace firmar y envía una llamada al contrato con `source` como cuenta fuente.
 * Sirve para `fund` e `repay` (la autorización de la fuente cubre la transferencia del token).
 */
export async function invokeAsSource(
  cfg: AppConfig,
  source: string,
  method: "fund" | "repay",
  invoiceId: number,
  sign: Signer,
): Promise<string> {
  const server = makeServer(cfg);
  const account = await server.getAccount(source);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: cfg.network })
    .addOperation(
      new Contract(cfg.contractId).call(
        method,
        nativeToScVal(invoiceId, { type: "u32" }),
        new Address(source).toScVal(),
      ),
    )
    .setTimeout(120)
    .build();
  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await sign(prepared.toXDR(), cfg.network);
  const signed = TransactionBuilder.fromXDR(signedXdr, cfg.network);
  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") throw new Error("La red rechazó la transacción");
  await waitForTx(server, sent.hash);
  return sent.hash;
}
