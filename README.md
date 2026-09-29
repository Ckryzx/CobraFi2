# CobraFi

Factoring de facturas electrónicas chilenas (DTE del SII) sobre **Stellar / Soroban**.

Las pymes chilenas esperan 30 a 90 días para cobrar. CobraFi permite tokenizar una factura,
recibir financiamiento inmediato en stablecoin de inversionistas de cualquier país, y liquidar
el pago al vencimiento vía smart contract.

## Por qué blockchain / Stellar
- **Anti doble-cesión:** cada factura tiene un hash único; el contrato rechaza registrarla dos veces.
- **Liquidación automática y transparente**, sin intermediario.
- **Capital global** con comisiones mínimas y liquidación en segundos.
- **Rampas fiat** vía anchors SEP-24/SEP-31; escalable a otros países cambiando el validador.

## Estructura
```
contracts/invoice_factoring   Smart contract Soroban (Rust)
backend                       API Node/TS: parser DTE + oráculo         (Día 3)
frontend                      Next.js + Tailwind                        (Día 4)
scripts                       Deploy testnet, token de prueba, demo     (Día 2)
docs                          Diagramas y guion de demo
```

## Contrato
Estados: `Registered -> Funded -> Repaid` (o `Defaulted`).

| Función | Descripción |
|---|---|
| `initialize(admin, oracle, token)` | Configuración inicial (una sola vez) |
| `register_invoice(issuer, hash, face_value, due_date, discount_bps)` | Requiere auth de emisor **y** oráculo. Rechaza hash repetido |
| `fund(invoice_id, investor)` | Inversionista paga `face * (10000 - bps)/10000` al emisor |
| `repay(invoice_id, payer)` | Pagador transfiere `face_value` al inversionista |
| `mark_default(invoice_id)` | Solo si `timestamp > due_date` y la factura está `Funded` |
| `get_invoice`, `get_invoice_id_by_hash`, `list_open_invoices(start_id, limit)`, `invoice_count` | Consultas (listado paginado, máx. 50) |

Eventos: `invoice_registered`, `invoice_funded`, `invoice_repaid`, `invoice_defaulted`.

Notas de diseño:
- On-chain solo hay hash del DTE y montos, nunca RUT ni razón social.
- `fund` no acepta facturas vencidas.
- `repay` no verifica que `payer` sea el deudor real de la factura (el MVP no lo exige); el pagador es quien firma.
  Queda como mejora: atar el deudor a un hash en el registro.

## Correr local
Requisitos: Rust, target `wasm32v1-none`, [stellar-cli](https://developers.stellar.org/docs/tools/cli) >= 25.2.0.

```bash
cargo test -p invoice-factoring      # 21 tests
stellar contract build               # genera el .wasm
```

## Direcciones en testnet
_Pendiente (Día 2)._

## Roadmap
Validación real contra el SII, validadores de otros países (México CFDI, Brasil NF-e), passkeys,
financiamiento fraccionado, off-ramp a CLP vía anchor SEP-24, reputación de deudores.
