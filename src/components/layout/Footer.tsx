import Link from "next/link";
import type { NavData } from "./nav-data";

export function Footer({ nav, footerText }: { nav: NavData; footerText?: string }) {
  return (
    <footer className="relative z-10 mt-32 border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        <div>
          <p className="font-display text-2xl">Family Heritage of Cora Mae Jackson</p>
          <p className="mt-3 max-w-md text-sm text-ink-3">{footerText ?? "Built to honor Ms. Cora and her commitment to her children. Brinkley, Arkansas, and everywhere the family has grown since."}</p>
        </div>
        <div>
          <p className="eyebrow mb-3">Explore</p>
          <ul className="space-y-2 text-sm">
            <li><Link className="link-underline" href="/family-tree">Family Tree</Link></li>
            <li><Link className="link-underline" href="/family">Family Lines</Link></li>
            <li><Link className="link-underline" href="/gallery">Gallery</Link></li>
            <li><Link className="link-underline" href="/history">History</Link></li>
            <li><Link className="link-underline" href="/stories">Stories</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-3">The Lines</p>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {nav.lines.map((l) => (
              <li key={l.slug}><Link className="link-underline" href={`/family/${l.slug}`}>{l.nickname ?? l.title.split(" ")[0]}</Link></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 pb-8 text-xs text-ink-3 md:px-8">
        <span>© {new Date().getFullYear()} The Jackson Family</span>
        <span className="font-mono">Content managed in Wix CMS</span>
      </div>
    </footer>
  );
}
