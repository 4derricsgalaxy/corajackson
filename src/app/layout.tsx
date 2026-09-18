import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { fraunces, newsreader, plexMono } from "./fonts";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { buildNavData } from "@/lib/nav";
import { getSettings } from "@/lib/content/queries";

export const revalidate = 3600;

const CMS = (process.env.NEXT_PUBLIC_SNACKBOX_URL ?? "https://snackboxcms.com").replace(/\/$/, "");
const PROJECT = process.env.NEXT_PUBLIC_SNACKBOX_PROJECT ?? "corajackson";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: s.title, template: `%s · ${s.title}` },
    description: s.tagline ?? "A living family tree honoring Ms. Cora Mae Jackson of Brinkley, Arkansas, her eight children, and every generation since.",
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    openGraph: { type: "website", siteName: s.title },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [nav, settings] = await Promise.all([buildNavData(), getSettings()]);
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${newsreader.variable} ${plexMono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('cj-theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="relative">
        <Header nav={nav} />
        <main className="relative z-10">{children}</main>
        <Footer nav={nav} footerText={settings.footerText} />
        {/* Snackbox on-page editing: inert for visitors, activates for signed-in editors */}
        <Script id="snackbox-overlay" strategy="afterInteractive" src={`${CMS}/overlay.js`} data-project={PROJECT} />
      </body>
    </html>
  );
}
