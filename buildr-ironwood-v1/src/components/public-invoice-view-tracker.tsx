"use client";

import { useEffect } from "react";
export function PublicInvoiceViewTracker({ token, via }: { token: string; via?: string }) {
  useEffect(() => {
    void fetch("/api/public/invoices/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        channel: via === "text" || via === "email" ? via : "direct",
      }),
    });
  }, [token, via]);

  return null;
}
