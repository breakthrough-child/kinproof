import { config } from "@/lib/config";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

const g = globalThis as unknown as { __kinproofStore?: Store };

/** Singleton store. In-memory only when Supabase keys are absent (dev/tests). */
export function getStore(): Store {
  if (!g.__kinproofStore) {
    g.__kinproofStore = config().storeMode === "supabase" ? new SupabaseStore() : new MemoryStore();
  }
  return g.__kinproofStore;
}

/** Test helper. */
export function setStore(s: Store | undefined) {
  g.__kinproofStore = s;
}

export type { Store } from "./types";
