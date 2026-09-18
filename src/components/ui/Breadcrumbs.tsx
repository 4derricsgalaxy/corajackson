import Link from "next/link";

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {it.href ? <Link href={it.href} className="link-underline hover:text-ink">{it.label}</Link> : <span className="text-ink">{it.label}</span>}
          {i < items.length - 1 && <span aria-hidden>›</span>}
        </span>
      ))}
    </nav>
  );
}
