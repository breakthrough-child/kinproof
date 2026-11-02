import { requireUserOrRedirect } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Settings · Kinproof" };

export default async function Settings() {
  const userId = await requireUserOrRedirect();
  const profile = (await getStore().getProfile(userId))!;
  return <SettingsForm profile={{ display_name: profile.display_name, preferred_language: profile.preferred_language, large_text: profile.large_text, phone: profile.phone }} />;
}
