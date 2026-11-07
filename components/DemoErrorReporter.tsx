"use client";
import { useEffect, useState } from "react";
import { isDemoMode } from "@/lib/demo";

/**
 * Error boundaries don't catch errors in event handlers or promises. In DEMO_MODE this shows those
 * (window 'error' and 'unhandledrejection') in a dismissible banner so they can be read on a phone.
 */
export function DemoErrorReporter() {
  const demo = isDemoMode();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!demo) return;
    const onError = (e: ErrorEvent) => setMsg(`${e.message}${e.filename ? ` (${e.filename.split("/").pop()}:${e.lineno})` : ""}`);
    const onRejection = (e: PromiseRejectionEvent) => setMsg(`Unhandled promise rejection: ${(e.reason as Error)?.message ?? String(e.reason)}`);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [demo]);

  if (!demo || !msg) return null;
  return (
    <div role="alert" data-testid="demo-runtime-error" className="fixed inset-x-0 bottom-0 z-[60] bg-dangersoft p-3 text-sm text-danger">
      <strong>Demo mode, runtime error:</strong> {msg}{" "}
      <button onClick={() => setMsg(null)} className="ml-2 font-semibold underline">Dismiss</button>
    </div>
  );
}
