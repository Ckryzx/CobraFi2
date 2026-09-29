use soroban_sdk::{contracterror, contracttype, Address, BytesN};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvoiceAlreadyRegistered = 3,
    InvoiceNotFound = 4,
    InvalidAmount = 5,
    InvalidDiscount = 6,
    InvalidDueDate = 7,
    InvalidStatus = 8,
    NotYetDue = 9,
    InvoiceExpired = 10,
    MathOverflow = 11,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Status {
    Registered,
    Funded,
    Repaid,
    Defaulted,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Invoice {
    pub id: u32,
    pub issuer: Address,
    pub invoice_hash: BytesN<32>,
    pub face_value: i128,
    pub due_date: u64,
    pub discount_bps: u32,
    pub status: Status,
    pub investor: Option<Address>,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Oracle,
    Token,
    NextId,
    Invoice(u32),
    HashIndex(BytesN<32>),
}
