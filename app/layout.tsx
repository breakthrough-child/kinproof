import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ConfirmationOverlay } from "@/components/ConfirmationOverlay";
import { PwaRegister } from "@/components/PwaRegister";
import { getUserId } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { mockBannerLabels } from "@/lib/config";

export const metadata: Metadata = {
  title: "Kinproof",
  description: "Proof of person, not proof of voice. Kinproof stops AI voice-clone scams by asking the real family member to confirm before money moves.",
  applicationName: "Kinproof",
  appleWebApp: { capable: true, title: "Kinproof", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#1b6b60", width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const userId = await getUserId();
  const profile = userId ? await getStore().getProfile(userId) : null;
  const mocks = mockBannerLabels();
  return (
    <html lang={profile?.preferred_language === "pcm" ? "en-NG" : "en"} className={profile?.large_text ? "large-text" : ""}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-3">Skip to content</a>
        {mocks.length > 0 && (
          <div role="status" className="bg-cautionsoft px-4 py-1.5 text-center text-sm font-semibold text-caution">
            Development mode: {mocks.join(" · ")}. Not the production setup.
          </div>
        )}
        <Nav name={profile?.display_name ?? null} />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">{children}</main>
        <footer className="border-t border-line bg-surface px-4 py-4 text-center text-sm text-muted">
          <strong className="text-ink">Sandbox demo — no real money moves.</strong> Kinproof is a hackathon prototype using PayPal Sandbox.
        </footer>
        {userId && <ConfirmationOverlay />}
        <PwaRegister />
      </body>
    </html>
  );
}
