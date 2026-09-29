# Despliegue público (Vercel + backend)

La app tiene dos piezas con necesidades distintas:

| Pieza | Dónde | Por qué |
|---|---|---|
| **Frontend** (Next.js) | **Vercel** | Es un Next.js estándar; Vercel lo detecta solo |
| **Backend / oráculo** (Express) | **Render, Railway o Fly.io** | Es un servidor de larga duración que guarda la clave del oráculo; en Vercel habría que reescribirlo como funciones serverless |
| **Contrato y token** | Ya están en Stellar Testnet | No se despliegan de nuevo |

## 1. Backend (ej. Render, servicio Web)
- Repo: `Ckryzx/CobraFi2` · Root Directory: `backend` · Build: `npm install` · Start: `npm start`
- Variables de entorno (copiar desde tu `.env` local):
  `CONTRACT_ID`, `TOKEN_CONTRACT_ID`, `ASSET_CODE`, `ASSET_ISSUER`, `ORACLE_SECRET`, `DEBTOR_PUBLIC`,
  `STELLAR_RPC_URL`, `STELLAR_NETWORK_PASSPHRASE`
- `CORS_ORIGIN` = la URL de tu frontend en Vercel (ej. `https://cobrafi.vercel.app`; admite varias separadas por coma)
- **`ORACLE_SECRET` solo va aquí**, nunca en el frontend ni en variables `NEXT_PUBLIC_*`.
- Verifica: `https://<tu-backend>/health` responde `{"ok":true}` y `/config` muestra tu contrato.

## 2. Frontend (Vercel)
- Import Git Repository → `Ckryzx/CobraFi2` · **Root Directory: `frontend`** · Framework: Next.js (automático)
- Variable: `NEXT_PUBLIC_BACKEND_URL` = URL pública del backend (sin `/` final)
- Deploy. Después vuelve al backend y ajusta `CORS_ORIGIN` con la URL final de Vercel.

## 3. Para que otras personas la prueben
- Necesitan **Freighter en Testnet** y una cuenta con **trustline de USDCt** y saldo. Hoy eso solo lo dan los scripts
  (`npm run faucet`), que usan la clave del emisor del token: no se expone al público. Para una demo abierta hay dos opciones:
  - importar en Freighter las cuentas demo del `.env` (Pyme, Inversionista, Deudor), o
  - agregar un endpoint "faucet" al backend (roadmap; requeriría límites de uso).
- El deudor de la demo es una dirección fija (`DEBTOR_PUBLIC`): las facturas de ejemplo solo las puede pagar esa cuenta.

## Notas
- Es Testnet: sin valor real. Si la red se reinicia, hay que volver a correr `./scripts/setup-testnet.sh` y actualizar
  `CONTRACT_ID`/`TOKEN_CONTRACT_ID` en el backend.
- Los datos del marketplace viven en la blockchain, no en el hosting: redeplegar el backend o el frontend no los borra.
