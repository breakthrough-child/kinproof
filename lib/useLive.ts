"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Fetches JSON and keeps it fresh: Supabase Realtime (when configured) triggers an
 * immediate refetch; a light poll is always on as a safety net.
 */
export function useLive<T>(url: string | null, opts: { pollMs?: number; tables?: string[] } = {}) {
  const { pollMs = 3000, tables = ["transfer_requests", "confirmations", "events"] } = opts;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tablesKey = tables.join(",");
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      if (!alive.current) return;
      if (!r.ok) setError(j.error ?? "Could not load");
      else {
        setError(null);
        setData(j as T);
      }
    } catch {
      if (alive.current) setError("You seem to be offline. Retrying...");
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    const first = setTimeout(load, 0);
    const t = setInterval(load, pollMs);
    // Realtime is an optimisation on top of polling: any failure to set it up is ignored.
    let sb: ReturnType<typeof supabaseBrowser> = null;
    let channel: ReturnType<NonNullable<ReturnType<typeof supabaseBrowser>>["channel"]> | null = null;
    try {
      sb = supabaseBrowser();
      if (sb) {
        channel = tablesKey
          .split(",")
          .reduce((ch, table) => ch.on("postgres_changes", { event: "*", schema: "public", table }, () => load()), sb.channel(`live-${url}`))
          .subscribe();
      }
    } catch {
      sb = null;
      channel = null;
    }
    return () => {
      alive.current = false;
      clearTimeout(first);
      clearInterval(t);
      try {
        if (sb && channel) void sb.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
  }, [load, pollMs, tablesKey, url]);

  return { data, error, reload: load };
}

export async function post<T = Record<string, unknown>>(url: string, body?: unknown): Promise<{ ok: boolean; data: T & { error?: string; code?: string } }> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}
