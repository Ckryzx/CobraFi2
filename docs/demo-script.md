# Guion de demo (≈ 4 minutos)

## Preparación (una vez)
1. `./scripts/setup-testnet.sh` (crea cuentas, USDCt, contrato; escribe `.env`).
2. `cd backend && npm run seed` (precarga 4 facturas en el marketplace). Si el saldo de una cuenta queda corto: `npm run faucet -- INVESTOR 40000`.
3. Terminal 1: `cd backend && npm run dev` · Terminal 2: `cd frontend && npm install && npm run dev`.
4. En **Freighter** (red **Testnet**) importa las 3 cuentas demo con las claves secretas de `.env`:
   `PYME_SECRET`, `INVESTOR_SECRET` y `DEBTOR_SECRET`. Renómbralas *Pyme*, *Inversionista*, *Deudor*.
5. Abre <http://localhost:3000> y verifica que el saldo de la cuenta Inversionista muestre 50.000 USDCt.
6. Para repetir la demo desde cero: vuelve a correr `./scripts/setup-testnet.sh` y `npm run seed` (contrato nuevo, marketplace limpio).

## Guion
| Min | Qué se muestra | Qué se dice |
|---|---|---|
| 0:00 | Home | "Las pymes chilenas cobran sus facturas a 30–90 días. CobraFi les da el dinero hoy, con capital de cualquier país, sobre Stellar." |
| 0:30 | **Pyme** → subir `factura_panaderia.xml` | "El backend lee el DTE del SII, calcula un hash único y lo valida. Aquí la validación con el SII está simulada; la interfaz está lista para la real y para otros países." |
| 1:00 | Slider de descuento → Registrar → firmar en Freighter | "El oráculo atestigua la factura y la pyme firma. El contrato guarda solo el hash y los montos: ningún dato personal." |
| 1:30 | Intentar registrar **el mismo XML otra vez** (o `npm run seed` de nuevo) | "Anti doble-cesión: el fraude clásico del factoring queda bloqueado por el contrato." |
| 2:00 | **Inversionista** → marketplace → Financiar | "Ve el rendimiento anualizado. Un clic y la pyme recibe USDCt en segundos, con comisiones de fracciones de centavo." |
| 2:30 | Cambiar a **Pyme** → saldo aumentado | "Recibió el dinero al instante, sin esperar al vencimiento." |
| 3:00 | **Deudor** → Pagar | "Al vencimiento, solo el deudor registrado puede pagar, y el contrato liquida directo al inversionista." |
| 3:30 | Línea de tiempo + stellar.expert | "Todo es auditable: eventos on-chain y transacciones verificables por cualquiera." |
| 3:50 | Roadmap | "SII real, otros países (CFDI, NF-e), passkeys, financiamiento fraccionado y off-ramp a CLP con anchors SEP-24." |

## Si algo falla en vivo
- *"No se pudo conectar con el backend"* → revisa que `npm run dev` corra en `backend` (puerto 8787).
- *Freighter en otra red* → cámbiala a Testnet (la app lo detecta y avisa).
- *Trustline / saldo* → usa las cuentas que creó `setup-testnet.sh`; ya tienen trustline y saldo.
- *"La fecha de vencimiento ya pasó"* → los XML de ejemplo vencen entre nov-2026 y feb-2027; edita `FchVenc` si la fecha de la demo ya pasó.
- Como respaldo, graba el video con anticipación.
