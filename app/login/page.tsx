import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { getUserId } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { DEMO } from "@/lib/store/seed";

export const metadata = { title: "Sign in · Kinproof" };

export default async function LoginPage() {
  if (await getUserId()) redirect("/send");
  const cfg = config();
  const demo = cfg.demoMode || cfg.storeMode === "memory";
  return <LoginForm demo={demo} supabase={cfg.storeMode === "supabase"} demoUsers={DEMO.users.map((u) => ({ key: u.key, name: u.name, label: u.label }))} />;
}
