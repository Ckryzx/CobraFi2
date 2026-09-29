export type InvoiceStatus = "Registered" | "Funded" | "Repaid" | "Defaulted";

export interface Invoice {
  id: number;
  issuer: string;
  debtor: string;
  invoiceHash: string; // hex
  faceValue: bigint;
  dueDate: number; // unix s
  discountBps: number;
  status: InvoiceStatus;
  investor: string | null;
}

export interface AppConfig {
  network: string;
  rpcUrl: string;
  contractId: string;
  tokenContractId: string;
  assetCode: string;
  assetIssuer: string;
  oraclePublicKey: string;
  clpPerUsd: number;
  validator: { country: string };
}

export interface ParseResult {
  dte: {
    tipoDTE: number;
    folio: number;
    rutEmisor: string;
    rutReceptor: string;
    montoTotal: number;
    fechaEmision: string;
    fechaVencimiento: string;
    invoiceHash: string;
  };
  validation: { valid: boolean; reason?: string };
  debtorFound: boolean;
  faceValueStroops: string;
  dueDate: number;
}

export interface ContractEvent {
  name: string; // invoice_registered | invoice_funded | invoice_repaid | invoice_defaulted
  invoiceId: number;
  txHash: string;
  closedAt: string;
  data: Record<string, unknown>;
}
