#!/usr/bin/env bash
# CobraFi — Día 2: crea cuentas demo, token de prueba USDCt (+SAC), despliega e inicializa el contrato en testnet.
# Requisitos: stellar-cli >= 25.2.0 y acceso a la testnet de Stellar (friendbot, soroban-testnet RPC).
# Uso: ./scripts/setup-testnet.sh   (idempotente en lo posible; reejecutar reutiliza las identidades)
# Escribe direcciones y claves en .env (ignorado por git). Solo claves de TESTNET.
set -euo pipefail
cd "$(dirname "$0")/.."

NET=testnet
ASSET_CODE=USDCt
WASM=target/wasm32v1-none/release/invoice_factoring.wasm
ACCOUNTS=(cobrafi-issuer cobrafi-admin cobrafi-oracle cobrafi-pyme cobrafi-investor cobrafi-debtor)

command -v stellar >/dev/null || { echo "Falta stellar-cli"; exit 1; }

echo "==> Compilando contrato"
stellar contract build >/dev/null
[ -f "$WASM" ] || { echo "No se generó $WASM"; exit 1; }

echo "==> Identidades (fondeadas con Friendbot)"
for a in "${ACCOUNTS[@]}"; do
  if stellar keys address "$a" >/dev/null 2>&1; then
    echo "  $a ya existe"
  else
    stellar keys generate "$a" --network "$NET" --fund >/dev/null
    echo "  $a creada y fondeada"
  fi
done
addr() { stellar keys address "$1"; }
secret() { stellar keys secret "$1"; }
ISSUER=$(addr cobrafi-issuer)
ASSET="$ASSET_CODE:$ISSUER"

echo "==> Trustlines de $ASSET_CODE"
for a in cobrafi-pyme cobrafi-investor cobrafi-debtor; do
  stellar tx new change-trust --source-account "$a" --line "$ASSET" --network "$NET" >/dev/null
  echo "  $a: trustline OK"
done

echo "==> Reparto de saldo (1 USDCt = 10000000 stroops)"
pay() { stellar tx new payment --source-account cobrafi-issuer --destination "$(addr "$1")" \
  --asset "$ASSET" --amount "$2" --network "$NET" >/dev/null; echo "  $1 <- $2 stroops"; }
pay cobrafi-investor 100000000000   # 10.000 USDCt
pay cobrafi-debtor    50000000000   #  5.000 USDCt (para pagar al vencimiento)
pay cobrafi-pyme        100000000   #     10 USDCt

echo "==> Stellar Asset Contract (SAC) del token"
TOKEN_ID=$(stellar contract asset deploy --asset "$ASSET" --source-account cobrafi-issuer --network "$NET" 2>/dev/null \
  || stellar contract id asset --asset "$ASSET" --network "$NET")
echo "  SAC: $TOKEN_ID"

echo "==> Despliegue del contrato"
CONTRACT_ID=$(stellar contract deploy --wasm "$WASM" --source-account cobrafi-admin --network "$NET")
echo "  Contrato: $CONTRACT_ID"

echo "==> initialize(admin, oracle, token)"
stellar contract invoke --id "$CONTRACT_ID" --source-account cobrafi-admin --network "$NET" -- \
  initialize --admin "$(addr cobrafi-admin)" --oracle "$(addr cobrafi-oracle)" --token "$TOKEN_ID" >/dev/null
echo "  OK"

echo "==> Escribiendo .env"
cat > .env <<ENV
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
CONTRACT_ID=$CONTRACT_ID
TOKEN_CONTRACT_ID=$TOKEN_ID
ASSET_CODE=$ASSET_CODE
ASSET_ISSUER=$ISSUER
ADMIN_PUBLIC=$(addr cobrafi-admin)
ORACLE_PUBLIC=$(addr cobrafi-oracle)
ORACLE_SECRET=$(secret cobrafi-oracle)
PYME_PUBLIC=$(addr cobrafi-pyme)
PYME_SECRET=$(secret cobrafi-pyme)
INVESTOR_PUBLIC=$(addr cobrafi-investor)
INVESTOR_SECRET=$(secret cobrafi-investor)
DEBTOR_PUBLIC=$(addr cobrafi-debtor)
DEBTOR_SECRET=$(secret cobrafi-debtor)
ENV
chmod 600 .env

echo
echo "Listo. Contrato: https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
echo "Copia CONTRACT_ID y TOKEN_CONTRACT_ID al README (sección 'Direcciones en testnet')."
