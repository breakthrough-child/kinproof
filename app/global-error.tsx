"use client";
import { ErrorView } from "@/components/ErrorView";

/** Last resort: the root layout itself failed. Must render its own <html>/<body>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#f6f4ee", margin: 0, padding: 16 }}>
        <ErrorView error={error} onRetry={reset} />
      </body>
    </html>
  );
}
