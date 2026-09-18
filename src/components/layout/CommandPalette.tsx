"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { NavLine, NavPerson } from "./nav-data";
import { CmsImage } from "../ui/CmsImage";

interface Props {
  open: boolean;
  onClose: () => void;
  people: NavPerson[];
  lines: NavLine[];
}

const GEN_LABEL = ["Matriarch", "Child of Cora", "Grandchild", "Great-grandchild", "Great-great-grandchild"];

export function CommandPalette({ open, onClose, people, lines }: Props) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) { setWasOpen(open); if (open) { setQ(""); setIdx(0); } }
  useEffect(() => {
    if (open) { const t = setTimeout(() => inputRef.current?.focus(), 30); return () => clearTimeout(t); }
  }, [open]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pages = [
      { slug: "/family-tree", title: "The Family Tree", sub: "Interactive 3D tree", kind: "page" as const },
      { slug: "/gallery", title: "Photo Gallery", sub: "All family photos", kind: "page" as const },
      { slug: "/history", title: "Family History", sub: "Timeline from Brinkley, Arkansas", kind: "page" as const },
      { slug: "/stories", title: "Stories", sub: "Memories told by the family", kind: "page" as const },
    ];
    const peopleHits = people
      .filter((p) => !needle || p.title.toLowerCase().includes(needle) || p.nickname?.toLowerCase().includes(needle) || p.lineTitle?.toLowerCase().includes(needle))
      .slice(0, needle ? 12 : 8)
      .map((p) => ({
        slug: `/family/${p.slug}`,
        title: p.title,
        sub: `${GEN_LABEL[p.generation] ?? "Family"}${p.lineTitle && p.generation > 1 ? ` · ${p.lineTitle}'s line` : ""}`,
        kind: "person" as const,
        portrait: p.portrait,
      }));
    const pageHits = pages.filter((p) => !needle || p.title.toLowerCase().includes(needle));
    return [...peopleHits, ...pageHits];
  }, [q, people]);

  const activeIdx = Math.min(idx, Math.max(results.length - 1, 0));

  const go = (href: string) => { onClose(); router.push(href); };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label="Search the family">
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-line bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-3"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx(Math.min(activeIdx + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx(Math.max(activeIdx - 1, 0)); }
              if (e.key === "Enter" && results[activeIdx]) go(results[activeIdx].slug);
            }}
            placeholder="Search a name, a nickname, or a family line…"
            className="w-full bg-transparent py-4 font-body text-lg outline-none placeholder:text-ink-3"
          />
          <kbd className="rounded border border-line px-1.5 font-mono text-[0.6rem] text-ink-3">esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-3">No one by that name yet. Family members can be added in the CMS.</li>}
          {results.map((r, i) => (
            <li key={r.slug}>
              <button
                type="button"
                onMouseEnter={() => setIdx(i)}
                onClick={() => go(r.slug)}
                className={clsx("flex w-full items-center gap-3 px-4 py-2.5 text-left transition", i === activeIdx ? "bg-paper-2" : "hover:bg-paper-2/60")}
              >
                {r.kind === "person" ? (
                  <span className="h-10 w-8 shrink-0 overflow-hidden rounded-sm bg-paper-3">
                    <CmsImage src={r.portrait} alt="" width={64} height={80} className="h-full w-full object-cover" />
                  </span>
                ) : (
                  <span className="grid h-10 w-8 shrink-0 place-items-center text-gold">✦</span>
                )}
                <span className="min-w-0">
                  <span className="block truncate">{r.title}</span>
                  <span className="block truncate text-xs text-ink-3">{r.sub}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!q && lines.length > 0 && (
          <div className="border-t border-line px-4 py-3">
            <p className="eyebrow mb-2">Jump to a line</p>
            <div className="flex flex-wrap gap-1.5">
              {lines.map((l) => (
                <button key={l.slug} type="button" onClick={() => go(`/family/${l.slug}`)} className="rounded-full border border-line px-2.5 py-1 text-xs transition hover:border-gold">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />{l.nickname ?? l.title.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
