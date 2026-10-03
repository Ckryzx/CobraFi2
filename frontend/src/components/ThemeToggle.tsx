"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";

/** Botón para alternar entre tema oscuro y claro (se recuerda en localStorage). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem("cobrafi.theme", next);
    } catch {}
  }

  const label = theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 cursor-pointer place-items-center overflow-hidden rounded-xl border border-line bg-ink/5 text-ink transition-colors hover:bg-ink/10"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={theme} initial={{ rotate: -80, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 80, opacity: 0, scale: 0.6 }} transition={{ duration: 0.18 }}>
          {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
