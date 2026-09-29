import dotenv from "dotenv";
import { z } from "zod";

// Lee primero backend/.env y, si no existe, el .env de la raíz (lo escribe scripts/setup-testnet.sh).
dotenv.config({ path: [".env", "../.env"], quiet: true });

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  STELLAR_RPC_URL: z.string().url().default("https://soroban-testnet.stellar.org"),
  STELLAR_NETWORK_PASSPHRASE: z.string().default("Test SDF Network ; September 2015"),
  CONTRACT_ID: z.string().min(1),
  TOKEN_CONTRACT_ID: z.string().default(""),
  ASSET_CODE: z.string().default("USDCt"),
  ASSET_ISSUER: z.string().default(""),
  ORACLE_SECRET: z.string().min(1),
  /** Pesos chilenos por 1 USDCt (solo referencial para la demo). */
  CLP_PER_USD: z.coerce.number().positive().default(950),
  /** true: el validador simulado solo acepta los XML de /samples. */
  MOCK_SII_STRICT: z.enum(["true", "false"]).default("false"),
  /** Dirección Stellar del deudor de la demo (receptor de los XML de ejemplo). */
  DEBTOR_PUBLIC: z.string().min(1),
  /** RUT receptor de los XML de ejemplo. */
  DEMO_DEBTOR_RUT: z.string().default("96.500.100-K"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ");
    throw new Error(`Configuración inválida (revisa .env):\n  ${missing}`);
  }
  return parsed.data;
}
