"use client";
import { useEffect } from "react";
import { ErrorView } from "@/components/ErrorView";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[kinproof] route error:", error);
  }, [error]);
  return <ErrorView error={error} onRetry={reset} />;
}
