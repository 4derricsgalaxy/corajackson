import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { bioFontVariables, clarendon, didot, lulo, poppins, proxima } from "./fonts";
import { getSettings } from "@/lib/content/queries";

export const revalidate = 3600;

const CMS = (process.env.NEXT_PUBLIC_SNACKBOX_URL ?? "https://snackboxcms.com").replace(/\/$/, "");
const PROJECT = process.env.NEXT_PUBLIC_SNACKBOX_PROJECT ?? "corajackson";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: s.title, template: `%s | ${s.title}` },
    description: s.tagline ?? "Honoring the life and legacy of Ms. Cora Mae Jackson of Brinkley, Arkansas, her eight children, and every generation since.",
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    openGraph: { type: "website", siteName: s.title },
  };
}

/**
 * The original Wix site had no header or menu: every page is a white canvas on
 * a gray surround, and navigation lives at the bottom of each page.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${proxima.variable} ${didot.variable} ${lulo.variable} ${clarendon.variable} ${poppins.variable} ${bioFontVariables}`}>
      <body>
        <main className="relative px-0 pb-[52px] pt-0 md:pt-[5px]">{children}</main>
        {/* Snackbox on-page editing: inert for visitors, activates for signed-in editors */}
        <Script id="snackbox-overlay" strategy="afterInteractive" src={`${CMS}/overlay.js`} data-project={PROJECT} />
      </body>
    </html>
  );
}
