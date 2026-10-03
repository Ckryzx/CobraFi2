"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Transición suave entre vistas (se re-monta en cada navegación). */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
