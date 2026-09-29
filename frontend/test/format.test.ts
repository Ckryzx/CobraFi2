import { describe, expect, it } from "vitest";
import { annualizedYield, daysUntil, formatUsdct, fundingAmount, shortHash, stroopsToClp } from "../src/lib/format";

const NOW = Date.parse("2026-10-01T00:00:00Z");
const due = (days: number) => Math.floor(NOW / 1000) + days * 86_400;

describe("format", () => {
  it("fundingAmount replica la fórmula del contrato", () => {
    expect(fundingAmount(10_000_000_000n, 500)).toBe(9_500_000_000n);
    expect(fundingAmount(1n, 500)).toBe(0n); // truncado como en el contrato
  });
  it("rendimiento anualizado", () => {
    // 5% descuento a 60 días: (1/0.95 - 1) * 365 / 60 ≈ 32%
    const y = annualizedYield(10_000_000_000n, 500, due(60), NOW);
    expect(y).toBeGreaterThan(0.32);
    expect(y).toBeLessThan(0.33);
  });
  it("rendimiento 0 si ya venció", () => {
    expect(annualizedYield(10_000_000_000n, 500, due(-1), NOW)).toBe(0);
  });
  it("daysUntil", () => {
    expect(daysUntil(due(30), NOW)).toBe(30);
  });
  it("montos", () => {
    expect(formatUsdct(9_500_000_000n)).toMatch(/950,00 USDCt/);
    expect(stroopsToClp(10_000_000_000n, 950)).toBe(950_000);
    expect(shortHash("a".repeat(64), 4)).toBe("aaaa…aaaa");
  });
});
