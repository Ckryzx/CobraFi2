# Folio — Factoring de facturas electrónicas chilenas sobre Stellar

> Nombre de trabajo "Folio" (cambiable). Proyecto para el General Track de una hackatón de Stellar.
> Deadline de entrega: **5 de octubre**. Desarrollador único. Prioridad absoluta: demo funcional de punta a punta en **testnet**.

## Visión en una frase
Las pymes chilenas esperan 30 a 90 días para cobrar sus facturas. Folio permite que una pyme tokenice una factura electrónica (DTE del SII), reciba financiamiento inmediato en stablecoin de inversionistas de cualquier país, y que el pago al vencimiento se liquide automáticamente vía smart contract en Soroban.

## Por qué blockchain y por qué Stellar (argumento central del pitch)
- **Anti doble-cesión:** el fraude clásico del factoring es vender la misma factura a dos financistas. El contrato registra un hash único por factura: una factura solo puede financiarse una vez, verificable por cualquiera.
- **Liquidación automática y transparente:** el contrato custodia y reparte fondos sin intermediario.
- **Capital global:** un inversionista en otro país financia una pyme chilena en USDC con comisiones de fracciones de centavo y liquidación en segundos.
- **Rampas fiat:** Stellar tiene anchors (SEP-24/SEP-31) para conectar stablecoins con pesos chilenos.
- **Escalable al mundo:** la facturación electrónica obligatoria crece en LatAm y Europa; solo cambia el módulo validador por país.

## Arquitectura

```
/contracts/invoice_factoring   -> Smart contract Soroban (Rust)
/backend                       -> API Node/TypeScript: parser DTE + "oráculo" que atestigua facturas
/frontend                      -> Next.js + TypeScript + Tailwind
/scripts                       -> Deploy a testnet, creación de token de prueba, datos demo
/docs                          -> Diagramas, guion de demo
```

### 1. Smart contract (Soroban, Rust)
Verificar SIEMPRE la versión actual de `soroban-sdk` y del `stellar` CLI en la documentación oficial (developers.stellar.org) antes de escribir código; no asumir APIs de memoria.

Estados de una factura: `Registered -> Funded -> Repaid` (o `Defaulted` si vence sin pago).

Funciones:
- `initialize(admin, oracle, token)` — `token` es la dirección del contrato del stablecoin (SAC).
- `register_invoice(issuer, invoice_hash: BytesN<32>, face_value: i128, due_date: u64, discount_bps: u32)`
  - Requiere `issuer.require_auth()` y `oracle.require_auth()` (el oráculo atestigua que la factura es válida).
  - Rechaza si `invoice_hash` ya existe (anti doble-cesión). Esta es la validación más importante: testearla bien.
  - Devuelve un `invoice_id`.
- `fund(invoice_id, investor)` — el inversionista transfiere `face_value * (10000 - discount_bps) / 10000` directamente al emisor. Estado -> `Funded`.
- `repay(invoice_id, payer)` — el pagador (deudor de la factura) transfiere `face_value` al inversionista. Estado -> `Repaid`.
- `mark_default(invoice_id)` — solo si `ledger timestamp > due_date` y no fue pagada.
- `get_invoice(invoice_id)`, `list_open_invoices()` (o paginado).
- Emitir **eventos** en cada cambio de estado (el frontend y el pitch los usan).

Reglas:
- Nunca guardar datos personales on-chain (ni RUT ni razón social en claro). Solo hash del DTE y montos.
- Errores tipados con `#[contracterror]`.
- Tests unitarios obligatorios: registro OK, doble registro rechazado, fund OK, fund doble rechazado, repay OK, default antes de vencimiento rechazado, autorizaciones faltantes rechazadas.

### 2. Token de prueba
En testnet, emitir un asset clásico propio (ej. `USDCt`) y envolverlo con su Stellar Asset Contract (SAC). Script que crea emisor, cuentas demo (pyme, inversionista, deudor), las fondea con Friendbot, crea trustlines y reparte saldo.

### 3. Backend "oráculo" (Node + TypeScript)
- Endpoint `POST /invoices/parse`: recibe un XML de DTE (factura electrónica chilena, tipo 33), extrae RUT emisor, RUT receptor, folio, monto total y fecha. Calcula `invoice_hash = sha256(rutEmisor|tipoDTE|folio)` (identifica la factura de forma única sin exponer datos).
- **Validación contra el SII: simulada** para la hackatón (un validador mock que acepta los XML de ejemplo). Dejar la interfaz `InvoiceValidator` lista para enchufar la validación real y validadores de otros países (México CFDI, Brasil NF-e). Explicarlo en el README como roadmap.
- El oráculo firma/autoriza la transacción `register_invoice` con su keypair.
- Incluir 3-4 XML de ejemplo con datos ficticios en `/backend/samples`.

### 4. Frontend (Next.js)
Conexión de wallet: **Stellar Wallets Kit** o Freighter (lo más estable primero). Tres vistas por rol:
- **Pyme:** subir XML -> ver datos extraídos -> elegir descuento -> registrar -> ver estado y recibir fondos.
- **Inversionista:** marketplace de facturas abiertas (monto, vencimiento, rendimiento anualizado calculado) -> financiar.
- **Deudor:** ver facturas por pagar -> pagar.
- Línea de tiempo por factura con los eventos del contrato y link a stellar.expert (testnet).
- Diseño limpio, en español, mobile-friendly. Mostrar montos en USDCt y su equivalente aproximado en CLP.

## Plan por día (no romper este orden)
1. **29-30 sep:** estructura del repo, contrato + tests pasando localmente.
2. **1 oct:** deploy a testnet, token de prueba, script de datos demo.
3. **2 oct:** backend parser DTE + oráculo + integración con el contrato.
4. **3 oct:** frontend con los tres flujos funcionando contra testnet.
5. **4 oct:** pulido UX, README, diagrama de arquitectura, guion de demo, grabación de video.
6. **5 oct:** buffer para errores y entrega. No agregar funciones nuevas este día.

## Stretch goals (solo si el MVP está 100% terminado)
1. Wallets con **passkeys** (smart wallets Soroban) para que la pyme no vea nunca una seed phrase.
2. **Financiamiento fraccionado:** varios inversionistas por factura (shares proporcionales).
3. Off-ramp a CLP vía anchor SEP-24 en testnet (SDF tiene un anchor de prueba).
4. Score de reputación del deudor según historial de pagos on-chain.

## Reglas de trabajo para Claude Code
- Trabajar en pasos pequeños, compilar y testear después de cada cambio.
- Antes de usar cualquier librería de Stellar, revisar su documentación/versión actual.
- Commits frecuentes con mensajes claros en español.
- Mantener un `README.md` actualizado con: qué es, cómo correrlo local, direcciones de contratos en testnet, arquitectura, roadmap.
- Si algo del plan resulta técnicamente inviable, avisar y proponer la alternativa más simple, no improvisar alcance extra.
- Variables sensibles (secret keys de testnet) en `.env`, nunca commiteadas; incluir `.env.example`.
