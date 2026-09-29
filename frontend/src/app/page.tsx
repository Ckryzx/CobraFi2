import Link from "next/link";

const ROLES = [
  { href: "/pyme", title: "Soy una pyme", text: "Sube tu factura electrónica (XML del SII), elige el descuento y recibe el dinero al instante en USDCt." },
  { href: "/inversionista", title: "Soy inversionista", text: "Financia facturas de pymes chilenas desde cualquier país y gana el descuento al vencimiento." },
  { href: "/deudor", title: "Debo una factura", text: "Consulta las facturas que tienes por pagar y liquídalas directo al inversionista." },
];

const WHY = [
  ["Anti doble-cesión", "Cada factura tiene un hash único: el contrato rechaza financiarla dos veces."],
  ["Liquidación automática", "El contrato mueve los fondos sin intermediarios, en segundos y por fracciones de centavo."],
  ["Capital global", "Un inversionista en cualquier país financia una pyme chilena en stablecoin."],
];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Cobra tus facturas hoy, <span className="text-brand-600">no en 90 días.</span>
        </h1>
        <p className="max-w-2xl text-slate-600">
          CobraFi tokeniza facturas electrónicas chilenas (DTE) sobre Stellar. La pyme recibe financiamiento inmediato,
          el inversionista gana el descuento y el pago al vencimiento se liquida por smart contract.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {ROLES.map((r) => (
          <Link key={r.href} href={r.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow">
            <h2 className="text-lg font-bold">{r.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{r.text}</p>
            <span className="mt-3 inline-block text-sm font-semibold text-brand-700">Entrar →</span>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {WHY.map(([t, d]) => (
          <div key={t}>
            <h3 className="font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
