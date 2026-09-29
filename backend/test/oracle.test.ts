import { describe, expect, it } from "vitest";
import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { Oracle, attachOracleAuth, explainError } from "../src/stellar/oracle.js";

const PASS = Networks.TESTNET;
const oracleKp = Keypair.random();
const issuerKp = Keypair.random();
const contractId = StrKey.encodeContract(Buffer.alloc(32, 7));

function authEntry(who: Address, sourceAccount = false) {
  const fn = xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
    new xdr.InvokeContractArgs({
      contractAddress: new Address(contractId).toScAddress(),
      functionName: "register_invoice",
      args: [],
    }),
  );
  const credentials = sourceAccount
    ? xdr.SorobanCredentials.sorobanCredentialsSourceAccount()
    : xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: who.toScAddress(),
          nonce: 42n,
          signatureExpirationLedger: 0,
          signature: xdr.ScVal.scvVoid(),
        }),
      );
  return new xdr.SorobanAuthorizationEntry({
    credentials,
    rootInvocation: new xdr.SorobanAuthorizedInvocation({ function: fn, subInvocations: [] }),
  });
}

function buildAssembled(auth: xdr.SorobanAuthorizationEntry[], fnName = "register_invoice", contract = contractId) {
  const builder = () =>
    new TransactionBuilder(new Account(issuerKp.publicKey(), "100"), { fee: "12345", networkPassphrase: PASS });
  const plain = builder()
    .addOperation(new Contract(contract).call(fnName, nativeToScVal(1, { type: "u32" })))
    .setTimeout(300)
    .build();
  const func = (plain.operations[0] as Operation.InvokeHostFunction).func;
  return TransactionBuilder.cloneFrom(plain)
    .clearOperations()
    .addOperation(Operation.invokeHostFunction({ func, auth }))
    .build();
}

describe("attachOracleAuth", () => {
  it("firma la autorización del oráculo y deja intacta la del emisor", async () => {
    const tx = buildAssembled([authEntry(new Address(issuerKp.publicKey()), true), authEntry(new Address(oracleKp.publicKey()))]);
    const out = await attachOracleAuth(tx, oracleKp, 1000, PASS);
    const op = out.operations[0] as Operation.InvokeHostFunction;
    expect(op.auth).toHaveLength(2);
    expect(op.auth![0].credentials.type).toBe("sorobanCredentialsSourceAccount");
    const creds = op.auth![1].credentials as any;
    expect(creds.value.signatureExpirationLedger).toBe(1000);
    expect(creds.value.signature.type).toBe("scvVec"); // firmada
    expect(out.fee).toBe(tx.fee);
    expect(out.source).toBe(issuerKp.publicKey());
  });

  it("falla si no hay autorización del oráculo", async () => {
    const tx = buildAssembled([authEntry(new Address(issuerKp.publicKey()), true)]);
    await expect(attachOracleAuth(tx, oracleKp, 1000, PASS)).rejects.toThrow(/oráculo/);
  });

  it("no firma entradas de otra dirección", async () => {
    const other = Keypair.random();
    const tx = buildAssembled([authEntry(new Address(other.publicKey()))]);
    await expect(attachOracleAuth(tx, oracleKp, 1000, PASS)).rejects.toThrow(/oráculo/);
  });
});

describe("assertRegisterTx", () => {
  const oracle = new Oracle({
    rpcUrl: "https://example.invalid",
    networkPassphrase: PASS,
    contractId,
    oracleSecret: oracleKp.secret(),
  });

  it("acepta register_invoice firmada del contrato", () => {
    const tx = buildAssembled([]);
    tx.sign(issuerKp);
    expect(() => oracle.assertRegisterTx(tx.toXDR())).not.toThrow();
  });
  it("rechaza sin firma", () => {
    expect(() => oracle.assertRegisterTx(buildAssembled([]).toXDR())).toThrow(/firmada/);
  });
  it("rechaza otra función", () => {
    const tx = buildAssembled([], "fund");
    tx.sign(issuerKp);
    expect(() => oracle.assertRegisterTx(tx.toXDR())).toThrow(/register_invoice/);
  });
  it("rechaza otro contrato", () => {
    const tx = buildAssembled([], "register_invoice", StrKey.encodeContract(Buffer.alloc(32, 9)));
    tx.sign(issuerKp);
    expect(() => oracle.assertRegisterTx(tx.toXDR())).toThrow(/este contrato/);
  });
  it("rechaza operaciones que no son de contrato", () => {
    const tx = new TransactionBuilder(new Account(issuerKp.publicKey(), "1"), { fee: BASE_FEE, networkPassphrase: PASS })
      .addOperation(Operation.payment({ destination: oracleKp.publicKey(), asset: Asset.native(), amount: "1" }))
      .setTimeout(30)
      .build();
    tx.sign(issuerKp);
    expect(() => oracle.assertRegisterTx(tx.toXDR())).toThrow();
  });
});

describe("explainError", () => {
  it("traduce errores del contrato", () => {
    expect(explainError("HostError: Error(Contract, #3)")).toMatch(/doble-cesión/);
    expect(explainError("HostError: Error(Contract, #12)")).toMatch(/deudor/);
    expect(explainError("otro")).toBe("otro");
  });
});
