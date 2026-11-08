import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ConfirmationOverlay } from "@/components/ConfirmationOverlay";
import { PwaRegister } from "@/components/PwaRegister";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DemoErrorReporter } from "@/components/DemoErrorReporter";
import { getUserId } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { mockBannerLabels } from "@/lib/config";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz"] });
const source = Source_Sans_3({ subsets: ["latin"], variable: "--font-source", display: "swap" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kinproof-nine.vercel.app";
const DESCRIPTION = "Proof of person, not proof of voice. Kinproof holds the payment and asks the real family member, on their own phone, before any money moves.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Kinproof",
  description: DESCRIPTION,
  openGraph: { title: "Kinproof: proof of person, not proof of voice", description: DESCRIPTION, siteName: "Kinproof", type: "website" },
  twitter: { card: "summary_large_image", title: "Kinproof: proof of person, not proof of voice", description: DESCRIPTION },
  applicationName: "Kinproof",
  appleWebApp: { capable: true, title: "Kinproof", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f7f1e5" }, { media: "(prefers-color-scheme: dark)", color: "#1b1713" }],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const userId = await getUserId();
  const profile = userId ? await getStore().getProfile(userId) : null;
  const mocks = mockBannerLabels();
  return (
    <html lang={profile?.preferred_language === "pcm" ? "en-NG" : "en"} className={`${fraunces.variable} ${source.variable} ${profile?.large_text ? "large-text" : ""}`}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-3">Skip to content</a>
        {mocks.length > 0 && (
          <div role="status" className="bg-cautionsoft px-4 py-1.5 text-center text-sm font-semibold text-caution">
            Development mode: {mocks.join(" · ")}. Not the production setup.
          </div>
        )}
        <ErrorBoundary label="nav"><Nav name={profile?.display_name ?? null} /></ErrorBoundary>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">{children}</main>
        <footer className={`border-t border-line bg-surface px-4 pt-5 text-sm text-muted ${userId ? "pb-28 md:pb-5" : "pb-5"}`}>
          <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p><strong className="text-ink">Sandbox demo — no real money moves.</strong> Kinproof is a hackathon prototype using PayPal Sandbox.</p>
            <nav aria-label="Legal" className="flex gap-4">
              <Link href="/privacy" className="font-semibold text-primary underline underline-offset-4">Privacy</Link>
              <Link href="/terms" className="font-semibold text-primary underline underline-offset-4">Terms</Link>
            </nav>
          </div>
        </footer>
        {userId && (
          <ErrorBoundary label="confirmation overlay">
            <ConfirmationOverlay />
          </ErrorBoundary>
        )}
        <DemoErrorReporter />
        <PwaRegister />
      </body>
    </html>
  );
}
