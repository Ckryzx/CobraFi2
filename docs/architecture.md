# Arquitectura de CobraFi

```mermaid
flowchart LR
  subgraph Navegador
    FE["Frontend Next.js<br/>Pyme · Inversionista · Deudor"]
    FR["Freighter<br/>(wallet)"]
  end
  subgraph Backend["Backend Node/TS (oráculo)"]
    P["Parser DTE tipo 33<br/>hash = sha256(rutEmisor|tipo|folio)"]
    V["InvoiceValidator<br/>MockSiiValidator → SII real (roadmap)"]
    D["DebtorDirectory<br/>RUT → dirección Stellar"]
    O["Oráculo<br/>firma su autorización"]
  end
  subgraph Stellar["Stellar Testnet"]
    C["Contrato Soroban<br/>invoice_factoring"]
    T["USDCt (SAC)"]
  end
  FE -- "1. XML" --> P --> V --> D --> O
  O -- "2. tx register_invoice + auth del oráculo" --> FE
  FE -- "3. firma" --> FR
  FE -- "4. submit" --> O -- "5. envía" --> C
  FE -- "fund / repay (firmados por la wallet)" --> C
  C -- "transfer" --> T
  FE -- "lecturas y eventos (RPC)" --> C
```

## Flujo de una factura

```mermaid
sequenceDiagram
  participant Pyme
  participant Oráculo as Backend (oráculo)
  participant Contrato as Contrato Soroban
  participant Inv as Inversionista
  participant Deu as Deudor
  Pyme->>Oráculo: XML del DTE + descuento
  Oráculo->>Oráculo: parsea, valida (SII simulado), resuelve deudor
  Oráculo-->>Pyme: tx register_invoice con autorización del oráculo firmada
  Pyme->>Contrato: tx firmada (emisor + oráculo) → Registered
  Inv->>Contrato: fund(id) · transfiere face×(1−descuento) a la pyme → Funded
  Deu->>Contrato: repay(id) · solo el deudor registrado · transfiere face al inversionista → Repaid
  Note over Contrato: si vence sin pago: mark_default → Defaulted
```

## Estados

`Registered → Funded → Repaid` · `Funded → Defaulted` (si `timestamp > due_date`).

## Decisiones de diseño

| Tema | Decisión |
|---|---|
| Anti doble-cesión | Índice `hash → id` en el contrato; registrar un hash existente falla (`InvoiceAlreadyRegistered`), sin importar quién sea el emisor |
| Privacidad | On-chain solo hash del DTE, montos, fechas y direcciones. Nunca RUT ni razón social |
| Doble autorización | `register_invoice` exige `issuer.require_auth()` y `oracle.require_auth()` |
| Deudor atado | El oráculo atestigua la dirección del deudor al registrar; solo ella puede llamar `repay` |
| Firma sin custodia | El backend nunca ve la clave de la pyme: arma la tx con el emisor como fuente y la wallet firma el sobre |
| Validador enchufable | `InvoiceValidator` permite reemplazar el mock por el SII real o por otros países (CFDI, NF-e) |
| Aritmética | Enteros (`i128`) con `checked_*`; el precio se trunca hacia abajo |
| Tipo de cambio | Referencial y fijo (`CLP_PER_USD`); un oráculo de precios reales es roadmap |

## Limitaciones conocidas (MVP)

- La validación contra el SII es simulada y el directorio de deudores es un mapa fijo.
- Un solo inversionista por factura (el financiamiento fraccionado es un stretch goal).
- `mark_default` no mueve fondos: solo registra la mora on-chain.
- El rendimiento anualizado mostrado es simple (no compuesto).
- Se asume un único token (USDCt) configurado al inicializar el contrato.
