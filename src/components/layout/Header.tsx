"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import type { NavData } from "./nav-data";
import { ThemeToggle } from "./ThemeToggle";
import { CmsImage } from "../ui/CmsImage";
import { CommandPalette } from "./CommandPalette";

const PRIMARY = [
  { href: "/family-tree", label: "Family Tree" },
  { href: "/family", label: "Family Lines", mega: true },
  { href: "/gallery", label: "Gallery" },
  { href: "/history", label: "History" },
  { href: "/stories", label: "Stories" },
];

export function Header({ nav }: { nav: NavData }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);
  // close menus when the route changes (state adjusted during render, per React guidance)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) { setLastPath(pathname); setOpen(false); setMega(false); }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(true); }
      if (e.key === "Escape") { setMega(false); setOpen(false); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <header
        className={clsx(
          "sticky top-0 z-40 transition-[background,box-shadow,backdrop-filter] duration-500",
          scrolled || mega ? "bg-paper/85 backdrop-blur-md shadow-[0_1px_0_var(--line)]" : "bg-transparent",
        )}
        onMouseLeave={() => setMega(false)}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 md:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-gold/60 text-gold transition group-hover:rotate-12">
              <Acorn />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[1.05rem] tracking-tight">Cora Mae Jackson</span>
              <span className="eyebrow block text-[0.6rem]">Family Heritage</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {PRIMARY.map((item) =>
              item.mega ? (
                <button
                  key={item.href}
                  type="button"
                  onMouseEnter={() => setMega(true)}
                  onFocus={() => setMega(true)}
                  onClick={() => setMega((v) => !v)}
                  aria-expanded={mega}
                  aria-controls="family-lines-menu"
                  className={clsx(
                    "link-underline flex items-center gap-1.5 px-3 py-2 text-[0.95rem] text-ink-2 transition hover:text-ink",
                    (mega || isActive(item.href)) && "text-ink",
                  )}
                >
                  {item.label}
                  <svg width="10" height="10" viewBox="0 0 10 10" className={clsx("transition", mega && "rotate-180")}><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
                </button>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onMouseEnter={() => setMega(false)}
                  className={clsx("link-underline px-3 py-2 text-[0.95rem] text-ink-2 transition hover:text-ink", isActive(item.href) && "text-ink")}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-ink-3 transition hover:border-gold hover:text-ink md:flex"
              aria-label="Search the family"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <span>Find someone</span>
              <kbd className="ml-1 rounded border border-line px-1.5 font-mono text-[0.6rem]">⌘K</kbd>
            </button>
            <ThemeToggle />
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full border border-line lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label="Open menu"
            >
              <span className="relative block h-3 w-4">
                <span className={clsx("absolute left-0 top-0 h-px w-4 bg-ink transition", open && "top-1.5 rotate-45")} />
                <span className={clsx("absolute left-0 top-1.5 h-px w-4 bg-ink transition", open && "opacity-0")} />
                <span className={clsx("absolute left-0 top-3 h-px w-4 bg-ink transition", open && "top-1.5 -rotate-45")} />
              </span>
            </button>
          </div>
        </div>

        {/* Mega menu: the eight family lines */}
        <div
          id="family-lines-menu"
          className={clsx(
            "hidden overflow-hidden border-t border-line transition-[max-height,opacity] duration-500 lg:block",
            mega ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="mx-auto grid max-w-7xl grid-cols-[1.2fr_repeat(4,1fr)] gap-6 px-8 py-8">
            <div className="pr-6">
              <p className="eyebrow mb-3">Family Lines</p>
              <p className="font-display text-2xl leading-snug">Eight children. <em className="text-gold">Every branch</em> has a page.</p>
              <p className="mt-3 text-sm text-ink-3">Follow any line down through grandchildren and great-grandchildren, or open the tree to see them all at once.</p>
              <Link href="/family" className="mt-5 inline-flex items-center gap-2 text-sm text-oak link-underline">Browse all lines <Arrow /></Link>
            </div>
            {nav.lines.map((line) => (
              <Link key={line.slug} href={`/family/${line.slug}`} className="group rounded-md p-2 transition hover:bg-paper-2">
                <div className="frame aspect-[4/5] overflow-hidden">
                  <CmsImage src={line.portrait} alt={line.title} width={220} height={275} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" sizes="200px" />
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg leading-tight">{line.nickname ?? line.title.split(" ")[0]}</p>
                    <p className="text-xs text-ink-3">{line.descendants} descendants</p>
                  </div>
                  <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: line.color }} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={clsx(
          "fixed inset-0 z-30 bg-paper/95 backdrop-blur-lg transition duration-500 lg:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="flex h-full flex-col overflow-y-auto px-6 pb-10 pt-24">
          {PRIMARY.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              style={{ transitionDelay: `${i * 60}ms` }}
              className={clsx("border-b border-line py-4 font-display text-3xl transition", open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}
            >
              {item.label}
            </Link>
          ))}
          <p className="eyebrow mt-8 mb-3">Family lines</p>
          <div className="grid grid-cols-2 gap-3">
            {nav.lines.map((line) => (
              <Link key={line.slug} href={`/family/${line.slug}`} className="flex items-center gap-3 rounded-md border border-line p-2">
                <div className="h-12 w-10 overflow-hidden">
                  <CmsImage src={line.portrait} alt="" width={80} height={96} className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="text-sm">{line.nickname ?? line.title}</p>
                  <p className="text-xs text-ink-3">{line.descendants} descendants</p>
                </div>
              </Link>
            ))}
          </div>
          <button type="button" onClick={() => { setOpen(false); setPaletteOpen(true); }} className="mt-8 rounded-full border border-line py-3 text-sm">Find someone</button>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} people={nav.people} lines={nav.lines} />
    </>
  );
}

function Acorn() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 10c0-3 2.5-5 6-5s6 2 6 5H6z" />
      <path d="M7 10c0 5 2 9 5 10 3-1 5-5 5-10" />
      <path d="M12 5V3" />
    </svg>
  );
}
function Arrow() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}
