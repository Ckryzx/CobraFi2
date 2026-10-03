"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { AppProvider } from "@/lib/app-context";

/** reducedMotion="user": respeta prefers-reduced-motion en todas las animaciones. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AppProvider>{children}</AppProvider>
    </MotionConfig>
  );
}
