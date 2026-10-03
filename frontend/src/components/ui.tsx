"use client";

import { AlertTriangle, CheckCircle2, Info, Inbox, Wallet } from "lucide-react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { STATUS_LABEL } from "@/lib/format";
import type { Invoice } from "@/lib/types";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface/80 p-5 shadow-[0_8px_30px_rgb(0_0_0/0.25)] backdrop-blur-md", className)}>
      {children}
    </div>
  );
}

const STATUS_STYLE: Record<Invoice["status"], string> = {
  Registered: "bg-brand/15 text-brand-soft ring-brand/30",
  Funded: "bg-ivory/10 text-ivory ring-ivory/30",
  Repaid: "bg-positive/15 text-positive ring-positive/30",
  Defaulted: "bg-danger/15 text-danger ring-danger/30",
};

export function StatusBadge({ status }: { status: Invoice["status"] }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", STATUS_STYLE[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

const button = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-ink shadow-[0_0_24px_rgb(245_158_11/0.25)] hover:bg-brand-soft",
        secondary: "border border-line bg-white/5 text-ink hover:bg-white/10",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

type ButtonProps = VariantProps<typeof button> & Omit<HTMLMotionProps<"button">, "children"> & { children: ReactNode };

export function Button({ children, variant, className, type = "button", disabled, ...rest }: ButtonProps) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={cn(button({ variant }), className)}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function Alert({ kind, children }: { kind: "error" | "ok" | "info"; children: ReactNode }) {
  const style = {
    error: "border-danger/30 bg-danger/10 text-red-200",
    ok: "border-positive/30 bg-positive/10 text-positive",
    info: "border-ivory/25 bg-ivory/10 text-ivory",
  }[kind];
  const Icon = { error: AlertTriangle, ok: CheckCircle2, info: Info }[kind];
  return (
    <motion.div
      role={kind === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", style)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </motion.div>
  );
}

export function Field({ label, value, accent }: { label: string; value: ReactNode; accent?: "positive" | "brand" }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className={cn("mt-1 break-words text-sm font-medium", accent === "positive" && "text-positive", accent === "brand" && "text-brand-soft")}>{value}</dd>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

export function InvoiceSkeleton() {
  return (
    <Card className="space-y-4">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </Card>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
      <Inbox className="h-6 w-6 opacity-60" aria-hidden />
      {children}
    </div>
  );
}

export function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h2 className="flex items-center gap-2 text-3xl">
      {children}
      {count !== undefined && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-muted">{count}</span>}
    </h2>
  );
}

export function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/15 text-brand-soft">
        <Wallet className="h-5 w-5" aria-hidden />
      </span>
      <p className="max-w-sm text-sm text-muted">Conecta tu wallet Freighter (red Testnet) para continuar.</p>
      <Button onClick={onConnect}>Conectar Freighter</Button>
    </Card>
  );
}
