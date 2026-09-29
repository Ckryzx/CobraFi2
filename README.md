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
backend                       API Node/TS: parser DTE + oráculo         (listo, ver abajo)
frontend                      Next.js + Tailwind (3 vistas por rol)
scripts                       Deploy a testnet, token de prueba, cuentas demo
docs                          Arquitectura (diagramas) y guion de demo
```

## Contrato
Estados: `Registered -> Funded -> Repaid` (o `Defaulted`).

| Función | Descripción |
|---|---|
| `initialize(admin, oracle, token)` | Configuración inicial (una sola vez) |
| `register_invoice(issuer, debtor, hash, face_value, due_date, discount_bps)` | Requiere auth de emisor **y** oráculo. Rechaza hash repetido. Ata la dirección del deudor |
| `fund(invoice_id, investor)` | Inversionista paga `face * (10000 - bps)/10000` al emisor |
| `repay(invoice_id, payer)` | Solo el deudor registrado (`NotDebtor` si no) transfiere `face_value` al inversionista |
| `mark_default(invoice_id)` | Solo si `timestamp > due_date` y la factura está `Funded` |
| `get_invoice`, `get_invoice_id_by_hash`, `list_open_invoices(start_id, limit)`, `invoice_count` | Consultas (listado paginado, máx. 50) |

Eventos: `invoice_registered`, `invoice_funded`, `invoice_repaid`, `invoice_defaulted`.

Notas de diseño:
- On-chain solo hay hash del DTE y montos, nunca RUT ni razón social.
- `fund` no acepta facturas vencidas.
- El deudor queda atado al registro: el oráculo atestigua qué dirección corresponde al RUT receptor del DTE
  (en la demo, el backend lo mapea). Solo esa dirección puede pagar; nadie más puede cerrar la factura.

## Correr local
Requisitos: Rust, target `wasm32v1-none`, [stellar-cli](https://developers.stellar.org/docs/tools/cli) >= 25.2.0.

```bash
cargo test -p invoice-factoring      # 23 tests
stellar contract build               # genera el .wasm
```

## Frontend
```bash
cd frontend && npm install
npm run dev         # http://localhost:3000  (NEXT_PUBLIC_BACKEND_URL, por defecto http://localhost:8787)
npm test            # formato y cálculo de rendimiento
```
Tres vistas por rol, con conexión a **Freighter** (red Testnet):
- **Pyme:** sube el XML → datos extraídos → elige el descuento → registra (firma con Freighter) → sigue el estado de sus facturas.
- **Inversionista:** marketplace de facturas abiertas (monto, vencimiento, precio, rendimiento anualizado) → financia.
- **Deudor:** facturas por pagar → paga.
Cada factura muestra su línea de tiempo con los eventos del contrato y enlaces a stellar.expert. Montos en USDCt con su equivalente aproximado en CLP.

## Backend (oráculo)
```bash
cd backend && npm install
npm test            # 30 tests
npm run dev         # lee ../.env (lo genera scripts/setup-testnet.sh)
npm run seed        # precarga el marketplace con los 4 XML de ejemplo (requiere testnet)
```
| Endpoint | Qué hace |
|---|---|
| `POST /invoices/parse` `{xml}` | Extrae RUT emisor/receptor, tipo, folio, monto y fechas del DTE (tipo 33); calcula `invoice_hash = sha256(rutEmisor\|tipoDTE\|folio)`; valida y estima el monto en USDCt |
| `POST /invoices/prepare` `{xml, issuer, discountBps}` | Si la factura es válida, arma la tx `register_invoice` (fuente = emisor) con la autorización del oráculo ya firmada y devuelve el XDR |
| `POST /invoices/submit` `{xdr}` | Recibe la tx firmada por el emisor (Freighter), verifica que sea solo `register_invoice` de este contrato y la envía |
| `GET /config` | Contrato, token, red y clave pública del oráculo (nunca secretos) |

Flujo de registro: la pyme sube el XML → `prepare` → firma con su wallet → `submit`. El oráculo solo firma si el validador acepta la factura.

- **Validación SII simulada:** `MockSiiValidator` implementa la interfaz `InvoiceValidator`. Roadmap: `SiiValidator` real,
  y otros países (México CFDI, Brasil NF-e) enchufando otra implementación.
- **Deudor:** el oráculo traduce el RUT receptor a una dirección Stellar (`DebtorDirectory`; en la demo, un mapa fijo).
- **Monto:** CLP → USDCt con `CLP_PER_USD` (por defecto 950, referencial). El vencimiento se toma como el fin de ese día en hora de Chile.
- **XML de ejemplo:** `backend/samples/` (4 facturas con datos ficticios; RUT con dígito verificador válido).
- El parser rechaza `DOCTYPE`/`ENTITY` (sin XXE) y XML de más de 1 MB.

## Despliegue en testnet
```bash
./scripts/setup-testnet.sh
```
Crea las cuentas demo (emisor del token, admin, oráculo, pyme, inversionista, deudor) con Friendbot, el token de prueba
`USDCt` con su SAC, despliega e inicializa el contrato y escribe todo en `.env` (ignorado por git).
Requiere `stellar-cli` >= 25.2.0 y salida a `soroban-testnet.stellar.org` / `friendbot.stellar.org`.

## Direcciones en testnet
_Pendiente: se completan al correr el script de despliegue._

| Elemento | Dirección |
|---|---|
| Contrato `invoice_factoring` | _por completar_ |
| Token USDCt (SAC) | _por completar_ |

## Documentación
- [Arquitectura y decisiones de diseño](docs/architecture.md)
- [Guion de demo](docs/demo-script.md)

## Estado del proyecto
| Pieza | Estado |
|---|---|
| Contrato Soroban | ✅ 23 tests |
| Backend / oráculo | ✅ 30 tests; API probada en local |
| Frontend | ✅ compila; probado en Chromium con RPC simulado (decodificación de datos del contrato incluida) |
| Despliegue y flujo completo en testnet | ⏳ pendiente de ejecutar `./scripts/setup-testnet.sh` con salida a la red |

## Roadmap
Validación real contra el SII, validadores de otros países (México CFDI, Brasil NF-e), passkeys,
financiamiento fraccionado, off-ramp a CLP vía anchor SEP-24, reputación de deudores.
