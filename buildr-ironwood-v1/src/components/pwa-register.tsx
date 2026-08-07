"use client";
import { useEffect } from "react";
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Buildr service worker registration failed:", error);
      });
    }
  }, []);
  return null;
}
