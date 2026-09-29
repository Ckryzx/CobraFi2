use soroban_sdk::{contractevent, Address, BytesN};

#[contractevent]
pub struct InvoiceRegistered {
    #[topic]
    pub invoice_id: u32,
    pub issuer: Address,
    pub debtor: Address,
    pub invoice_hash: BytesN<32>,
    pub face_value: i128,
    pub due_date: u64,
    pub discount_bps: u32,
}

#[contractevent]
pub struct InvoiceFunded {
    #[topic]
    pub invoice_id: u32,
    pub investor: Address,
    pub issuer: Address,
    pub amount: i128,
}

#[contractevent]
pub struct InvoiceRepaid {
    #[topic]
    pub invoice_id: u32,
    pub payer: Address,
    pub investor: Address,
    pub amount: i128,
}

#[contractevent]
pub struct InvoiceDefaulted {
    #[topic]
    pub invoice_id: u32,
}
