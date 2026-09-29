#!/usr/bin/env bash
# CobraFi — despliegue a testnet: compila el contrato y ejecuta backend/scripts/setup-testnet.ts (SDK de JS).
# Requisitos: stellar-cli >= 25.2.0 (solo para compilar el wasm), Node >= 22 y acceso a la testnet.
# En entornos que exigen proxy (HTTPS_PROXY), Node lo respeta con NODE_USE_ENV_PROXY=1 (se activa aquí).
set -euo pipefail
cd "$(dirname "$0")/.."

command -v stellar >/dev/null || { echo "Falta stellar-cli (para compilar el wasm)"; exit 1; }
echo "==> Compilando contrato"
stellar contract build >/dev/null
( cd backend && npm install --silent )
export NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1
cd backend && npx tsx scripts/setup-testnet.ts
