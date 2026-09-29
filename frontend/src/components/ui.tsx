import type { ReactNode } from "react";
import { STATUS_LABEL } from "@/lib/format";
import type { Invoice } from "@/lib/types";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

const STATUS_STYLE: Record<Invoice["status"], string> = {
  Registered: "bg-amber-100 text-amber-800",
  Funded: "bg-sky-100 text-sky-800",
  Repaid: "bg-emerald-100 text-emerald-800",
  Defaulted: "bg-rose-100 text-rose-800",
};

export function StatusBadge({ status }: { status: Invoice["status"] }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
}) {
  const base = "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
  const style =
    variant === "primary"
      ? "bg-brand-600 text-white hover:bg-brand-700"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${style}`}>
      {children}
    </button>
  );
}

export function Alert({ kind, children }: { kind: "error" | "ok" | "info"; children: ReactNode }) {
  const style = {
    error: "border-rose-200 bg-rose-50 text-rose-800",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${style}`}>
      {children}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

export function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <Card className="text-center">
      <p className="mb-3 text-sm text-slate-600">Conecta tu wallet Freighter (red Testnet) para continuar.</p>
      <Button onClick={onConnect}>Conectar Freighter</Button>
    </Card>
  );
}
