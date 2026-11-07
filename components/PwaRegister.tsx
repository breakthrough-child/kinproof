"use client";
import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/browser";

export function PwaRegister() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
