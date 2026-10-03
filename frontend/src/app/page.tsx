"use client";

import { motion, type Variants } from "framer-motion";
import { ArrowRight, BadgeCheck, Building2, Coins, EyeOff, FileUp, Globe, Landmark, Lock, ShieldCheck, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { Skeleton } from "@/components/ui";
import { useApp } from "@/lib/app-context";
import { stroopsToNumber } from "@/lib/format";

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const item: Variants = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };

const ROLES = [
  { href: "/pyme", icon: Building2, title: "Soy una pyme", text: "Sube tu factura electrónica (XML del SII), elige el descuento y recibe el dinero al instante en USDCt." },
  { href: "/inversionista", icon: TrendingUp, title: "Soy inversionista", text: "Financia facturas de pymes chilenas desde cualquier país y gana el descuento al vencimiento." },
  { href: "/deudor", icon: Landmark, title: "Debo una factura", text: "Consulta las facturas que tienes por pagar y liquídalas directo al inversionista." },
];

const STEPS = [
  { icon: FileUp, title: "Sube el DTE", text: "La pyme carga el XML de su factura electrónica." },
  { icon: ShieldCheck, title: "El oráculo atestigua", text: "Se valida y se calcula un hash único, sin datos personales." },
  { icon: Coins, title: "Se financia", text: "Un inversionista paga con descuento y la pyme cobra al instante." },
  { icon: BadgeCheck, title: "Se liquida", text: "Al vencimiento paga el deudor y el contrato reparte los fondos." },
];

const WHY = [
  { icon: Lock, title: "Anti doble-cesión", text: "Cada factura tiene un hash único: el contrato rechaza financiarla dos veces." },
  { icon: Zap, title: "Liquidación en segundos", text: "Sin intermediarios y por fracciones de centavo de comisión." },
  { icon: Globe, title: "Capital global", text: "Inversionistas de cualquier país financian pymes chilenas en stablecoin." },
  { icon: EyeOff, title: "Privacidad", text: "On-chain solo viven el hash del DTE y los montos: nunca RUT ni razón social." },
];

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/70 px-5 py-4 backdrop-blur-md">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="font-display mt-1 text-4xl">{children}</p>
    </div>
  );
}

export default function Home() {
  const { invoices, loading, config } = useApp();
  const ready = invoices.length > 0 || (!loading && config !== null);
  const volume = invoices.reduce((s, i) => s + stroopsToNumber(i.faceValue), 0);
  const funded = invoices.filter((i) => i.status === "Funded" || i.status === "Repaid").length;
  const repaid = invoices.filter((i) => i.status === "Repaid").length;

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="grid items-center gap-10 md:grid-cols-[1.15fr_0.85fr]">
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
          <motion.span variants={item} className="inline-flex items-center gap-2 rounded-full border border-line bg-ink/5 px-3 py-1 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-soft" /> Factoring sobre Stellar · Soroban
          </motion.span>
          <motion.h1 variants={item} className="text-5xl leading-[1.04] sm:text-7xl">
            Cobra tus facturas hoy, <span className="bg-gradient-to-r from-brand-soft to-ivory bg-clip-text text-transparent">no en 90 días.</span>
          </motion.h1>
          <motion.p variants={item} className="max-w-xl text-base leading-relaxed text-muted">
            CobraFi tokeniza facturas electrónicas chilenas (DTE) en Stellar. La pyme recibe financiamiento inmediato, el inversionista gana el descuento y el pago al vencimiento se liquida por smart contract.
          </motion.p>
          <motion.div variants={item} className="flex flex-wrap gap-3">
            <Link href="/pyme" className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-ink shadow-[0_0_28px_rgb(245_158_11/0.3)] transition-colors hover:brightness-110">
              Financiar una factura <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/inversionista" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-ink/5 px-5 py-3 text-sm font-semibold transition-colors hover:bg-ink/10">
              Ver el marketplace
            </Link>
          </motion.div>
        </motion.div>

        {/* Tarjeta ilustrativa */}
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.2 }} className="relative">
          <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-brand/20 blur-3xl" aria-hidden />
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="rounded-3xl border border-ink/15 bg-gradient-to-br from-surface-2 to-surface p-6 shadow-card">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Ejemplo ilustrativo</span>
              <span className="rounded-full bg-brand/15 px-2 py-0.5 font-semibold text-brand-soft">Financiada</span>
            </div>
            <p className="mt-4 text-xs text-muted">Factura electrónica · valor</p>
            <p className="font-display text-6xl">4.000,00 <span className="font-sans text-lg text-muted">USDCt</span></p>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted">La pyme recibe hoy</span><span className="font-semibold text-brand-soft">3.760,00 USDCt</span></div>
              <div className="flex justify-between"><span className="text-muted">Rend. anualizado</span><span className="font-semibold text-positive">31,1%</span></div>
              <div className="flex justify-between"><span className="text-muted">Vence en</span><span className="font-semibold">75 días</span></div>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-ink/10">
              <motion.div initial={{ width: 0 }} animate={{ width: "66%" }} transition={{ duration: 1.2, delay: 0.6 }} className="h-full rounded-full bg-gradient-to-r from-brand to-ivory" />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Datos reales del contrato */}
      <section aria-label="Actividad on-chain" className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Actividad real en el contrato (Stellar Testnet)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {ready ? (
            <>
              <Stat label="Facturas registradas"><CountUp value={invoices.length} /></Stat>
              <Stat label="Volumen tokenizado"><CountUp value={volume} decimals={0} suffix=" USDCt" /></Stat>
              <Stat label="Financiadas · pagadas"><CountUp value={funded} /> · <CountUp value={repaid} /></Stat>
            </>
          ) : (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-[84px]" />)
          )}
        </div>
      </section>

      {/* Roles */}
      <motion.section variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="grid gap-4 sm:grid-cols-3">
        {ROLES.map((r) => (
          <motion.div key={r.href} variants={item} whileHover={{ y: -4 }}>
            <Link href={r.href} className="group block h-full cursor-pointer rounded-2xl border border-line bg-surface/80 p-5 backdrop-blur-md transition-colors hover:border-brand/50">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/15 text-brand-soft transition-colors group-hover:bg-brand group-hover:text-brand-ink">
                <r.icon className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-3xl">{r.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{r.text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-soft">
                Entrar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          </motion.div>
        ))}
      </motion.section>

      {/* Cómo funciona */}
      <section className="space-y-6">
        <h2 className="text-4xl">Cómo funciona</h2>
        <motion.ol variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.li key={s.title} variants={item} className="relative rounded-2xl border border-line bg-surface/60 p-5">
              <span className="absolute right-4 top-2 font-display text-5xl text-ink/5">{i + 1}</span>
              <s.icon className="h-5 w-5 text-brand-soft" aria-hidden />
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </motion.li>
          ))}
        </motion.ol>
      </section>

      {/* Por qué Stellar */}
      <section className="space-y-6">
        <h2 className="text-4xl">Por qué blockchain, por qué Stellar</h2>
        <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="grid gap-4 sm:grid-cols-2">
          {WHY.map((w) => (
            <motion.div key={w.title} variants={item} className="flex gap-4 rounded-2xl border border-line bg-surface/60 p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ivory/10 text-ivory">
                <w.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold">{w.title}</h3>
                <p className="mt-1 text-sm text-muted">{w.text}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
