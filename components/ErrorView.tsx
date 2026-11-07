import { isDemoMode } from "@/lib/demo";

export interface ErrorLike {
  name?: string;
  message?: string;
  digest?: string;
  stack?: string;
}

/**
 * What a visitor sees after a crash. In DEMO_MODE it shows the real error (name, message, digest, stack)
 * so failures on a phone can be read and reported. Otherwise: a calm generic message only.
 * Pure markup (no hooks, no browser APIs) so it can never fail itself.
 */
export function ErrorView({ error, demo = isDemoMode(), onRetry, compact = false }: { error: ErrorLike; demo?: boolean; onRetry?: () => void; compact?: boolean }) {
  const message = error?.message || "Unknown error";
  return (
    <div role="alert" style={{ margin: compact ? "12px" : "32px auto", maxWidth: 640, padding: 20, borderRadius: 16, border: "1px solid #d9d4c6", background: "#fff", color: "#1a2330", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontSize: 20, margin: 0 }}>Something went wrong on this screen</h2>
      <p style={{ margin: "8px 0 0" }}>Your money is safe: nothing moves without a confirmation. Please try again.</p>
      {demo && (
        <div data-testid="demo-error-details" style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#fbe3e0", color: "#5c1410", fontSize: 14, wordBreak: "break-word" }}>
          <strong>Demo mode: error details</strong>
          <div style={{ marginTop: 6 }}>
            {error?.name ? `${error.name}: ` : ""}
            {message}
          </div>
          {error?.digest && <div style={{ marginTop: 6 }}>Digest: {error.digest}</div>}
          {error?.stack && <pre style={{ marginTop: 8, maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap", fontSize: 12 }}>{error.stack.split("\n").slice(0, 8).join("\n")}</pre>}
        </div>
      )}
      {onRetry && (
        <button onClick={onRetry} style={{ marginTop: 16, minHeight: 48, padding: "0 20px", borderRadius: 12, border: 0, background: "#1b6b60", color: "#fff", fontSize: 16, fontWeight: 600 }}>
          Try again
        </button>
      )}
    </div>
  );
}
