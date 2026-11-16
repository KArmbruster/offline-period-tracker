"use client";

import { useEffect } from "react";
import { basePath } from "@/lib/base-path";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // The native app ships its files in the bundle; it needs no service worker
    const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (capacitor?.isNativePlatform?.()) return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${basePath}/sw.js`)
        .then((registration) => {
          console.log("Service Worker registered with scope:", registration.scope);
        })
        .catch((error) => {
          console.log("Service Worker registration failed:", error);
        });
    }
  }, []);

  return null;
}
