import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Operation,
  Transaction,
  TransactionBuilder,
  authorizeEntry,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

export interface OracleOptions {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  oracleSecret: string;
}

export interface RegisterParams {
  issuer: string;
  debtor: string;
  invoiceHashHex: string;
  faceValue: bigint;
  dueDate: number;
  discountBps: number;
}

const CONTRACT_ERRORS: Record<number, string> = {
  1: "El contrato ya estaba inicializado",
  2: "El contrato no está inicializado",
  3: "Esta factura ya fue registrada (anti doble-cesión)",
  4: "Factura no encontrada",
  5: "Monto inválido",
  6: "Descuento inválido",
  7: "La fecha de vencimiento ya pasó",
  8: "Estado de factura inválido para esta operación",
  9: "La factura aún no vence",
  10: "La factura ya venció",
  11: "Desborde aritmético",
  12: "Solo el deudor registrado puede pagar esta factura",
};

export class OracleError extends Error {}

export function explainError(raw: string): string {
  // El token (SAC) también usa códigos de error pequeños (p. ej. #10 = saldo insuficiente): no confundirlos con los nuestros.
  if (/balance is not within the allowed range|trustline entry is missing/i.test(raw)) {
    return "Saldo insuficiente de USDCt o falta la trustline del token";
  }
  const m = /Error\(Contract, #(\d+)\)/.exec(raw);
  if (m) return CONTRACT_ERRORS[Number(m[1])] ?? `Error del contrato #${m[1]}`;
  return raw;
}

/**
 * Firma con el keypair del oráculo sus entradas de autorización (credenciales de dirección) y deja
 * intactas las del emisor (cuenta fuente: se autoriza con la firma del sobre). Conserva fee y datos Soroban.
 */
export async function attachOracleAuth(
  assembled: Transaction,
  oracle: Keypair,
  validUntilLedger: number,
  networkPassphrase: string,
): Promise<Transaction> {
  const op = assembled.operations[0] as Operation.InvokeHostFunction;
  if (assembled.operations.length !== 1 || op.type !== "invokeHostFunction") {
    throw new OracleError("Se esperaba una sola operación invokeHostFunction");
  }
  let oracleSigned = false;
  const auth: xdr.SorobanAuthorizationEntry[] = [];
  for (const entry of op.auth ?? []) {
    const creds = entry.credentials;
    if (creds.type === "sorobanCredentialsAddress" || creds.type === "sorobanCredentialsAddressV2") {
      const addr = Address.fromScAddress(creds.value.address).toString();
      if (addr === oracle.publicKey()) {
        auth.push(await authorizeEntry(entry, oracle, validUntilLedger, networkPassphrase));
        oracleSigned = true;
        continue;
      }
    }
    auth.push(entry);
  }
  if (!oracleSigned) {
    throw new OracleError("La simulación no pidió autorización del oráculo (¿contrato mal configurado?)");
  }
  // cloneFrom del SDK no conserva los datos de recursos Soroban (footprint, fee): hay que pasarlos.
  const envelope = assembled.toEnvelope();
  const ext = envelope.type === "envelopeTypeTx" ? envelope.value.tx.ext : undefined;
  const sorobanData = ext?.type === "sorobanData" ? ext.value : undefined;
  if (!sorobanData) throw new OracleError("La transacción preparada no incluye datos de recursos de Soroban");
  return TransactionBuilder.cloneFrom(assembled, { sorobanData })
    .clearOperations()
    .addOperation(Operation.invokeHostFunction({ func: op.func, auth }))
    .build();
}

/** "Oráculo": atestigua facturas firmando su autorización en `register_invoice`. */
export class Oracle {
  private readonly server: rpc.Server;
  private readonly keypair: Keypair;
  private readonly contract: Contract;

  constructor(private readonly opts: OracleOptions) {
    this.server = new rpc.Server(opts.rpcUrl, { allowHttp: opts.rpcUrl.startsWith("http://") });
    this.keypair = Keypair.fromSecret(opts.oracleSecret);
    this.contract = new Contract(opts.contractId);
  }

  get publicKey(): string {
    return this.keypair.publicKey();
  }

  /**
   * Construye la tx `register_invoice` con el emisor como fuente (firma el sobre con su wallet)
   * y la autorización del oráculo ya firmada. Devuelve el XDR listo para que el emisor lo firme.
   */
  async prepareRegister(p: RegisterParams): Promise<string> {
    const account = await this.server.getAccount(p.issuer);
    const op = this.contract.call(
      "register_invoice",
      new Address(p.issuer).toScVal(),
      new Address(p.debtor).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(p.invoiceHashHex, "hex")),
      nativeToScVal(p.faceValue, { type: "i128" }),
      nativeToScVal(p.dueDate, { type: "u64" }),
      nativeToScVal(p.discountBps, { type: "u32" }),
    );
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.opts.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(300)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new OracleError(explainError(sim.error));

    const assembled = rpc.assembleTransaction(tx, sim).build();
    const latest = await this.server.getLatestLedger();
    const validUntil = latest.sequence + 200; // ~ 17 min

    const final = await attachOracleAuth(assembled, this.keypair, validUntil, this.opts.networkPassphrase);
    return final.toXDR();
  }

  /** Verifica que el XDR firmado sea solo una llamada a `register_invoice` de nuestro contrato. */
  assertRegisterTx(txXdr: string): Transaction {
    const tx = new Transaction(txXdr, this.opts.networkPassphrase);
    if (tx.operations.length !== 1) throw new OracleError("La transacción debe tener una sola operación");
    const op = tx.operations[0] as Operation.InvokeHostFunction;
    if (op.type !== "invokeHostFunction" || op.func.type !== "hostFunctionTypeInvokeContract") {
      throw new OracleError("Operación no permitida");
    }
    const inv = op.func.invokeContract;
    const contract = Address.fromScAddress(inv.contractAddress).toString();
    if (contract !== this.opts.contractId || inv.functionName.toString() !== "register_invoice") {
      throw new OracleError("Solo se aceptan transacciones register_invoice de este contrato");
    }
    if (tx.signatures.length === 0) throw new OracleError("La transacción no está firmada por el emisor");
    return tx;
  }

  /** Envía la tx firmada por el emisor y espera el resultado. */
  async submit(txXdr: string): Promise<{ txHash: string; invoiceId: number }> {
    const tx = this.assertRegisterTx(txXdr);
    const sent = await this.server.sendTransaction(tx);
    if (sent.status === "ERROR") throw new OracleError(`La red rechazó la transacción: ${sent.errorResult?.toXDR("base64") ?? "sin detalle"}`);
    for (let i = 0; i < 30; i++) {
      const res = await this.server.getTransaction(sent.hash);
      if (res.status === "SUCCESS") {
        const invoiceId = res.returnValue ? Number(scValToNative(res.returnValue)) : -1;
        return { txHash: sent.hash, invoiceId };
      }
      if (res.status === "FAILED") throw new OracleError("La transacción falló en la red");
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new OracleError(`Tiempo de espera agotado; revisa la tx ${sent.hash}`);
  }
}
