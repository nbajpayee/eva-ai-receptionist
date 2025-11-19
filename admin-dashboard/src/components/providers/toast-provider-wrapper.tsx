"use client";

import { ToastProvider } from "@/hooks/use-toast";

export function ToastProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
