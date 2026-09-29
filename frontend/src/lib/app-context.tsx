"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getConfig } from "./api";
import { fetchBalance, fetchEvents, fetchInvoices } from "./contract";
import { connectFreighter, signWithFreighter } from "./wallet";
import type { AppConfig, ContractEvent, Invoice } from "./types";

interface AppState {
  config: AppConfig | null;
  configError: string | null;
  address: string | null;
  balance: bigint | null;
  invoices: Invoice[];
  events: ContractEvent[];
  loading: boolean;
  dataError: string | null;
  connect(): Promise<void>;
  disconnect(): void;
  refresh(): Promise<void>;
  sign(xdr: string, passphrase: string): Promise<string>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp fuera de AppProvider");
  return v;
}

const ADDR_KEY = "cobrafi.address";

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    getConfig().then(setConfig).catch((e: Error) => setConfigError(e.message));
    try {
      const saved = localStorage.getItem(ADDR_KEY);
      if (saved) setAddress(saved);
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    setDataError(null);
    try {
      const [inv, evs, bal] = await Promise.all([
        fetchInvoices(config),
        fetchEvents(config).catch(() => [] as ContractEvent[]), // los eventos son un extra: no rompen la vista
        address ? fetchBalance(config, address).catch(() => null) : Promise.resolve(null),
      ]);
      setInvoices(inv);
      setEvents(evs);
      setBalance(bal);
    } catch (e) {
      setDataError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [config, address]);

  useEffect(() => {
    if (!config) return;
    refresh();
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [config, refresh]);

  const connect = useCallback(async () => {
    const a = await connectFreighter();
    setAddress(a);
    try {
      localStorage.setItem(ADDR_KEY, a);
    } catch {}
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setBalance(null);
    try {
      localStorage.removeItem(ADDR_KEY);
    } catch {}
  }, []);

  const sign = useCallback(
    (xdr: string, passphrase: string) => signWithFreighter(xdr, passphrase, address ?? undefined),
    [address],
  );

  const value = useMemo<AppState>(
    () => ({ config, configError, address, balance, invoices, events, loading, dataError, connect, disconnect, refresh, sign }),
    [config, configError, address, balance, invoices, events, loading, dataError, connect, disconnect, refresh, sign],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
