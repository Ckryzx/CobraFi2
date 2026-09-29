#![no_std]
//! CobraFi — contrato de factoring de facturas electrónicas sobre Soroban.
//!
//! Flujo: `Registered -> Funded -> Repaid` (o `Defaulted` si vence sin pago).
//! On-chain solo se guardan el hash del DTE y montos: nunca datos personales.

mod events;
mod types;

#[cfg(test)]
mod test;

use events::*;
use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, Vec};
pub use types::{DataKey, Error, Invoice, Status};

const BPS_DENOMINATOR: i128 = 10_000;
const MAX_PAGE: u32 = 50;
// ~30 días de umbral / ~60 días de extensión (ledgers de ~5s).
const TTL_THRESHOLD: u32 = 518_400;
const TTL_EXTEND: u32 = 1_036_800;

#[contract]
pub struct InvoiceFactoring;

#[contractimpl]
impl InvoiceFactoring {
    /// Configura admin, oráculo y token (SAC del stablecoin). Solo una vez.
    pub fn initialize(env: Env, admin: Address, oracle: Address, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Oracle, &oracle);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::NextId, &1u32);
        Ok(())
    }

    /// Registra una factura atestiguada por el oráculo. Rechaza hashes repetidos
    /// (anti doble-cesión). Requiere la autorización del emisor y del oráculo.
    /// `debtor` es la dirección que podrá pagar la factura (el oráculo la atestigua).
    pub fn register_invoice(
        env: Env,
        issuer: Address,
        debtor: Address,
        invoice_hash: BytesN<32>,
        face_value: i128,
        due_date: u64,
        discount_bps: u32,
    ) -> Result<u32, Error> {
        let oracle: Address = get_instance(&env, &DataKey::Oracle)?;
        issuer.require_auth();
        oracle.require_auth();

        if face_value <= 0 {
            return Err(Error::InvalidAmount);
        }
        if discount_bps as i128 >= BPS_DENOMINATOR {
            return Err(Error::InvalidDiscount);
        }
        if due_date <= env.ledger().timestamp() {
            return Err(Error::InvalidDueDate);
        }

        let hash_key = DataKey::HashIndex(invoice_hash.clone());
        if env.storage().persistent().has(&hash_key) {
            return Err(Error::InvoiceAlreadyRegistered);
        }

        let id: u32 = get_instance(&env, &DataKey::NextId)?;
        let next = id.checked_add(1).ok_or(Error::MathOverflow)?;
        env.storage().instance().set(&DataKey::NextId, &next);

        let invoice = Invoice {
            id,
            issuer: issuer.clone(),
            debtor: debtor.clone(),
            invoice_hash: invoice_hash.clone(),
            face_value,
            due_date,
            discount_bps,
            status: Status::Registered,
            investor: None,
        };
        save_invoice(&env, &invoice);
        env.storage().persistent().set(&hash_key, &id);
        bump_persistent(&env, &hash_key);
        bump_instance(&env);

        InvoiceRegistered { invoice_id: id, issuer, debtor, invoice_hash, face_value, due_date, discount_bps }
            .publish(&env);
        Ok(id)
    }

    /// El inversionista paga `face_value * (10000 - discount_bps) / 10000` al emisor.
    pub fn fund(env: Env, invoice_id: u32, investor: Address) -> Result<(), Error> {
        investor.require_auth();
        let mut invoice = load_invoice(&env, invoice_id)?;
        if invoice.status != Status::Registered {
            return Err(Error::InvalidStatus);
        }
        if env.ledger().timestamp() >= invoice.due_date {
            return Err(Error::InvoiceExpired);
        }

        let amount = funding_amount(invoice.face_value, invoice.discount_bps)?;
        let token_addr: Address = get_instance(&env, &DataKey::Token)?;
        token::Client::new(&env, &token_addr).transfer(&investor, &invoice.issuer, &amount);

        invoice.status = Status::Funded;
        invoice.investor = Some(investor.clone());
        save_invoice(&env, &invoice);

        InvoiceFunded { invoice_id, investor, issuer: invoice.issuer, amount }.publish(&env);
        Ok(())
    }

    /// El deudor registrado transfiere `face_value` al inversionista.
    /// Rechaza a cualquier otro pagador con `NotDebtor`.
    pub fn repay(env: Env, invoice_id: u32, payer: Address) -> Result<(), Error> {
        payer.require_auth();
        let mut invoice = load_invoice(&env, invoice_id)?;
        if payer != invoice.debtor {
            return Err(Error::NotDebtor);
        }
        if invoice.status != Status::Funded {
            return Err(Error::InvalidStatus);
        }
        let investor = invoice.investor.clone().ok_or(Error::InvalidStatus)?;

        let token_addr: Address = get_instance(&env, &DataKey::Token)?;
        token::Client::new(&env, &token_addr).transfer(&payer, &investor, &invoice.face_value);

        invoice.status = Status::Repaid;
        save_invoice(&env, &invoice);

        InvoiceRepaid { invoice_id, payer, investor, amount: invoice.face_value }.publish(&env);
        Ok(())
    }

    /// Marca como impaga una factura financiada cuyo vencimiento ya pasó. Cualquiera puede llamarla.
    pub fn mark_default(env: Env, invoice_id: u32) -> Result<(), Error> {
        let mut invoice = load_invoice(&env, invoice_id)?;
        if invoice.status != Status::Funded {
            return Err(Error::InvalidStatus);
        }
        if env.ledger().timestamp() <= invoice.due_date {
            return Err(Error::NotYetDue);
        }
        invoice.status = Status::Defaulted;
        save_invoice(&env, &invoice);

        InvoiceDefaulted { invoice_id }.publish(&env);
        Ok(())
    }

    pub fn get_invoice(env: Env, invoice_id: u32) -> Result<Invoice, Error> {
        load_invoice(&env, invoice_id)
    }

    /// Id de la factura asociada a un hash, si existe.
    pub fn get_invoice_id_by_hash(env: Env, invoice_hash: BytesN<32>) -> Option<u32> {
        env.storage().persistent().get(&DataKey::HashIndex(invoice_hash))
    }

    /// Facturas en estado `Registered`, paginadas: recorre ids desde `start_id`
    /// hasta `limit` (máx. 50) ids revisados.
    pub fn list_open_invoices(env: Env, start_id: u32, limit: u32) -> Vec<Invoice> {
        let next: u32 = env.storage().instance().get(&DataKey::NextId).unwrap_or(1);
        let limit = limit.min(MAX_PAGE);
        let mut out = Vec::new(&env);
        let mut id = start_id.max(1);
        let mut scanned = 0u32;
        while id < next && scanned < limit {
            if let Some(inv) = env.storage().persistent().get::<_, Invoice>(&DataKey::Invoice(id)) {
                if inv.status == Status::Registered {
                    out.push_back(inv);
                }
            }
            id += 1;
            scanned += 1;
        }
        out
    }

    /// Cantidad de facturas registradas.
    pub fn invoice_count(env: Env) -> u32 {
        let next: u32 = env.storage().instance().get(&DataKey::NextId).unwrap_or(1);
        next - 1
    }
}

fn funding_amount(face_value: i128, discount_bps: u32) -> Result<i128, Error> {
    let factor = BPS_DENOMINATOR - discount_bps as i128;
    face_value
        .checked_mul(factor)
        .ok_or(Error::MathOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(Error::MathOverflow)
}

fn get_instance<T: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>>(
    env: &Env,
    key: &DataKey,
) -> Result<T, Error> {
    env.storage().instance().get(key).ok_or(Error::NotInitialized)
}

fn load_invoice(env: &Env, id: u32) -> Result<Invoice, Error> {
    env.storage().persistent().get(&DataKey::Invoice(id)).ok_or(Error::InvoiceNotFound)
}

fn save_invoice(env: &Env, invoice: &Invoice) {
    let key = DataKey::Invoice(invoice.id);
    env.storage().persistent().set(&key, invoice);
    bump_persistent(env, &key);
}

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND);
}

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
}
