/** True when the deployment runs with DEMO_MODE=true (mirrored to the client by next.config.ts). */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
