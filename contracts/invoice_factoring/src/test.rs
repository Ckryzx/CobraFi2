#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    token::{Client as TokenClient, StellarAssetClient},
    Address, BytesN, Env, IntoVal,
};

const FACE: i128 = 1_000_0000000; // 1000 USDCt (7 decimales)
const DISCOUNT: u32 = 500; // 5%
const NET: i128 = 950_0000000;
const DUE: u64 = 10_000;

struct Ctx<'a> {
    env: Env,
    client: InvoiceFactoringClient<'a>,
    token: TokenClient<'a>,
    issuer: Address,
    investor: Address,
    debtor: Address,
}

fn setup<'a>() -> Ctx<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);

    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    let issuer = Address::generate(&env);
    let investor = Address::generate(&env);
    let debtor = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token = TokenClient::new(&env, &sac.address());
    let minter = StellarAssetClient::new(&env, &sac.address());
    minter.mint(&investor, &(5 * FACE));
    minter.mint(&debtor, &(5 * FACE));

    let id = env.register(InvoiceFactoring, ());
    let client = InvoiceFactoringClient::new(&env, &id);
    client.initialize(&admin, &oracle, &sac.address());

    Ctx { env, client, token, issuer, investor, debtor }
}

fn hash(env: &Env, n: u8) -> BytesN<32> {
    BytesN::from_array(env, &[n; 32])
}

fn register(c: &Ctx, n: u8) -> u32 {
    c.client.register_invoice(&c.issuer, &hash(&c.env, n), &FACE, &DUE, &DISCOUNT)
}

#[test]
fn registro_ok() {
    let c = setup();
    let id = register(&c, 1);
    assert_eq!(id, 1);
    let inv = c.client.get_invoice(&id);
    assert_eq!(inv.status, Status::Registered);
    assert_eq!(inv.face_value, FACE);
    assert_eq!(inv.investor, None);
    assert_eq!(c.client.get_invoice_id_by_hash(&hash(&c.env, 1)), Some(1));
    assert_eq!(c.client.invoice_count(), 1);
}

#[test]
fn doble_registro_rechazado() {
    let c = setup();
    register(&c, 1);
    let r = c.client.try_register_invoice(&c.issuer, &hash(&c.env, 1), &FACE, &DUE, &DISCOUNT);
    assert_eq!(r, Err(Ok(Error::InvoiceAlreadyRegistered)));
    // otro emisor tampoco puede registrar el mismo hash
    let other = Address::generate(&c.env);
    let r = c.client.try_register_invoice(&other, &hash(&c.env, 1), &FACE, &DUE, &DISCOUNT);
    assert_eq!(r, Err(Ok(Error::InvoiceAlreadyRegistered)));
    assert_eq!(c.client.invoice_count(), 1);
}

#[test]
fn registro_valida_parametros() {
    let c = setup();
    let h = hash(&c.env, 9);
    assert_eq!(
        c.client.try_register_invoice(&c.issuer, &h, &0, &DUE, &DISCOUNT),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        c.client.try_register_invoice(&c.issuer, &h, &FACE, &DUE, &10_000),
        Err(Ok(Error::InvalidDiscount))
    );
    assert_eq!(
        c.client.try_register_invoice(&c.issuer, &h, &FACE, &1_000, &DISCOUNT),
        Err(Ok(Error::InvalidDueDate))
    );
}

#[test]
fn fund_ok() {
    let c = setup();
    let id = register(&c, 1);
    c.client.fund(&id, &c.investor);

    assert_eq!(c.token.balance(&c.issuer), NET);
    assert_eq!(c.token.balance(&c.investor), 5 * FACE - NET);
    let inv = c.client.get_invoice(&id);
    assert_eq!(inv.status, Status::Funded);
    assert_eq!(inv.investor, Some(c.investor.clone()));
    assert_eq!(c.client.list_open_invoices(&1, &50).len(), 0);
}

#[test]
fn fund_doble_rechazado() {
    let c = setup();
    let id = register(&c, 1);
    c.client.fund(&id, &c.investor);
    let r = c.client.try_fund(&id, &c.investor);
    assert_eq!(r, Err(Ok(Error::InvalidStatus)));
    assert_eq!(c.token.balance(&c.issuer), NET); // no se cobró dos veces
}

#[test]
fn fund_factura_vencida_rechazado() {
    let c = setup();
    let id = register(&c, 1);
    c.env.ledger().set_timestamp(DUE + 1);
    assert_eq!(c.client.try_fund(&id, &c.investor), Err(Ok(Error::InvoiceExpired)));
}

#[test]
fn repay_ok() {
    let c = setup();
    let id = register(&c, 1);
    c.client.fund(&id, &c.investor);
    c.client.repay(&id, &c.debtor);

    assert_eq!(c.token.balance(&c.debtor), 4 * FACE);
    assert_eq!(c.token.balance(&c.investor), 5 * FACE - NET + FACE);
    assert_eq!(c.client.get_invoice(&id).status, Status::Repaid);
    // no se puede pagar dos veces
    assert_eq!(c.client.try_repay(&id, &c.debtor), Err(Ok(Error::InvalidStatus)));
}

#[test]
fn repay_sin_fondear_rechazado() {
    let c = setup();
    let id = register(&c, 1);
    assert_eq!(c.client.try_repay(&id, &c.debtor), Err(Ok(Error::InvalidStatus)));
}

#[test]
fn default_antes_de_vencimiento_rechazado() {
    let c = setup();
    let id = register(&c, 1);
    c.client.fund(&id, &c.investor);
    assert_eq!(c.client.try_mark_default(&id), Err(Ok(Error::NotYetDue)));
    c.env.ledger().set_timestamp(DUE); // en el instante exacto aún no vence
    assert_eq!(c.client.try_mark_default(&id), Err(Ok(Error::NotYetDue)));
}

#[test]
fn default_despues_de_vencimiento_ok() {
    let c = setup();
    let id = register(&c, 1);
    c.client.fund(&id, &c.investor);
    c.env.ledger().set_timestamp(DUE + 1);
    c.client.mark_default(&id);
    assert_eq!(c.client.get_invoice(&id).status, Status::Defaulted);
    assert_eq!(c.client.try_repay(&id, &c.debtor), Err(Ok(Error::InvalidStatus)));
}

#[test]
fn default_de_factura_pagada_rechazado() {
    let c = setup();
    let id = register(&c, 1);
    c.client.fund(&id, &c.investor);
    c.client.repay(&id, &c.debtor);
    c.env.ledger().set_timestamp(DUE + 1);
    assert_eq!(c.client.try_mark_default(&id), Err(Ok(Error::InvalidStatus)));
}

#[test]
fn factura_inexistente() {
    let c = setup();
    assert_eq!(c.client.try_get_invoice(&99), Err(Ok(Error::InvoiceNotFound)));
    assert_eq!(c.client.try_fund(&99, &c.investor), Err(Ok(Error::InvoiceNotFound)));
}

#[test]
fn initialize_solo_una_vez() {
    let c = setup();
    let a = Address::generate(&c.env);
    let r = c.client.try_initialize(&a, &a, &a);
    assert_eq!(r, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn listado_paginado_solo_abiertas() {
    let c = setup();
    for n in 1..=5u8 {
        register(&c, n);
    }
    c.client.fund(&2, &c.investor);
    let all = c.client.list_open_invoices(&1, &50);
    assert_eq!(all.len(), 4);
    let page = c.client.list_open_invoices(&1, &2); // revisa ids 1 y 2 -> solo el 1 abierto
    assert_eq!(page.len(), 1);
    assert_eq!(page.get(0).unwrap().id, 1);
    let rest = c.client.list_open_invoices(&3, &50);
    assert_eq!(rest.len(), 3);
}

// ---------- Autorizaciones ----------

#[test]
fn registro_sin_ninguna_auth_rechazado() {
    // Cliente nuevo sin mock_all_auths
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let id = env.register(InvoiceFactoring, ());
    let client = InvoiceFactoringClient::new(&env, &id);
    let (a, o, t) = (Address::generate(&env), Address::generate(&env), Address::generate(&env));
    client.initialize(&a, &o, &t);
    let issuer = Address::generate(&env);
    let r = client.try_register_invoice(&issuer, &hash(&env, 1), &FACE, &DUE, &DISCOUNT);
    assert!(r.is_err());
}

#[test]
fn registro_sin_auth_del_oraculo_rechazado() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let id = env.register(InvoiceFactoring, ());
    let client = InvoiceFactoringClient::new(&env, &id);
    let (admin, oracle, tok) =
        (Address::generate(&env), Address::generate(&env), Address::generate(&env));
    client.initialize(&admin, &oracle, &tok);
    let issuer = Address::generate(&env);
    let h = hash(&env, 1);

    // Solo firma el emisor
    let r = client
        .mock_auths(&[MockAuth {
            address: &issuer,
            invoke: &MockAuthInvoke {
                contract: &id,
                fn_name: "register_invoice",
                args: (&issuer, &h, FACE, DUE, DISCOUNT).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_register_invoice(&issuer, &h, &FACE, &DUE, &DISCOUNT);
    assert!(r.is_err());
}

#[test]
fn registro_sin_auth_del_emisor_rechazado() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let id = env.register(InvoiceFactoring, ());
    let client = InvoiceFactoringClient::new(&env, &id);
    let (admin, oracle, tok) =
        (Address::generate(&env), Address::generate(&env), Address::generate(&env));
    client.initialize(&admin, &oracle, &tok);
    let issuer = Address::generate(&env);
    let h = hash(&env, 1);

    // Solo firma el oráculo
    let r = client
        .mock_auths(&[MockAuth {
            address: &oracle,
            invoke: &MockAuthInvoke {
                contract: &id,
                fn_name: "register_invoice",
                args: (&issuer, &h, FACE, DUE, DISCOUNT).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_register_invoice(&issuer, &h, &FACE, &DUE, &DISCOUNT);
    assert!(r.is_err());
}

#[test]
fn registro_con_ambas_auths_ok() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let id = env.register(InvoiceFactoring, ());
    let client = InvoiceFactoringClient::new(&env, &id);
    let (admin, oracle, tok) =
        (Address::generate(&env), Address::generate(&env), Address::generate(&env));
    client.initialize(&admin, &oracle, &tok);
    let issuer = Address::generate(&env);
    let h = hash(&env, 1);
    let args: soroban_sdk::Vec<soroban_sdk::Val> =
        (&issuer, &h, FACE, DUE, DISCOUNT).into_val(&env);
    let invoke = MockAuthInvoke {
        contract: &id,
        fn_name: "register_invoice",
        args,
        sub_invokes: &[],
    };
    let r = client
        .mock_auths(&[
            MockAuth { address: &issuer, invoke: &invoke },
            MockAuth { address: &oracle, invoke: &invoke },
        ])
        .try_register_invoice(&issuer, &h, &FACE, &DUE, &DISCOUNT);
    assert!(r.is_ok());
}

#[test]
fn fund_sin_auth_del_inversionista_rechazado() {
    let c = setup();
    let id = register(&c, 1);
    // Sin mocks: se pierde mock_all_auths reemplazándolo por lista vacía
    let r = c.client.mock_auths(&[]).try_fund(&id, &c.investor);
    assert!(r.is_err());
    assert_eq!(c.client.get_invoice(&id).status, Status::Registered);
}

#[test]
fn repay_sin_auth_del_pagador_rechazado() {
    let c = setup();
    let id = register(&c, 1);
    c.client.fund(&id, &c.investor);
    let r = c.client.mock_auths(&[]).try_repay(&id, &c.debtor);
    assert!(r.is_err());
    assert_eq!(c.client.get_invoice(&id).status, Status::Funded);
}

// ---------- Eventos ----------

#[test]
fn emite_eventos() {
    use soroban_sdk::testutils::Events;
    let c = setup();
    register(&c, 1);
    assert_eq!(c.env.events().all().events().len(), 1);
}
