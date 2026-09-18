"use client";
import { useState } from "react";
import { CmsImage } from "../ui/CmsImage";
import { aspectOf, fullSrc } from "@/lib/content/image";
import type { SiteImage } from "@/lib/content/types";

export interface GridPhoto { _id: string; image: SiteImage; title?: string; caption?: string; year?: number }

/** Masonry-ish photo grid that reveals `pageSize` photos at a time and opens a lightbox. */
export function PhotoGrid({ photos, pageSize = 24 }: { photos: GridPhoto[]; pageSize?: number }) {
  const [shown, setShown] = useState(pageSize);
  const [open, setOpen] = useState<number | null>(null);
  const visible = photos.slice(0, shown);
  return (
    <>
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
        {visible.map((p, i) => (
          <button key={p._id} type="button" onClick={() => setOpen(i)} className="group block w-full break-inside-avoid text-left">
            <div className="frame overflow-hidden" style={{ aspectRatio: aspectOf(p.image, 4 / 5) }}>
              <CmsImage src={p.image} alt={p.title || p.caption || "Family photo"} width={420} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
            </div>
            {(p.caption || p.title) && <p className="mt-1.5 truncate text-xs text-ink-3">{p.caption || p.title}{p.year ? ` · ${p.year}` : ""}</p>}
          </button>
        ))}
      </div>
      {shown < photos.length && (
        <div className="mt-8 text-center">
          <button type="button" onClick={() => setShown((s) => s + pageSize)} className="rounded-full border border-ink px-6 py-2.5 text-sm transition hover:bg-ink hover:text-paper">
            Show {Math.min(pageSize, photos.length - shown)} more <span className="text-ink-3">({photos.length - shown} left)</span>
          </button>
        </div>
      )}
      {open !== null && photos[open] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 backdrop-blur-sm" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button type="button" className="absolute right-5 top-5 text-paper/80 hover:text-paper" aria-label="Close" onClick={() => setOpen(null)}>✕</button>
          {open > 0 && <button type="button" className="absolute left-4 text-3xl text-paper/70 hover:text-paper" aria-label="Previous" onClick={(e) => { e.stopPropagation(); setOpen(open - 1); }}>‹</button>}
          {open < photos.length - 1 && <button type="button" className="absolute right-4 text-3xl text-paper/70 hover:text-paper" aria-label="Next" onClick={(e) => { e.stopPropagation(); setOpen(open + 1); if (open + 1 >= shown) setShown((s) => s + pageSize); }}>›</button>}
          <figure className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- lightbox, Wix CDN */}
            <img src={fullSrc(photos[open].image)} srcSet={photos[open].image.srcset || undefined} sizes="90vw" alt={photos[open].title ?? ""} className="max-h-[82vh] w-auto object-contain shadow-2xl" />
            {(photos[open].caption || photos[open].title) && <figcaption className="mt-3 text-center text-sm text-paper/80">{photos[open].caption || photos[open].title}{photos[open].year ? ` · ${photos[open].year}` : ""}</figcaption>}
          </figure>
        </div>
      )}
    </>
  );
}
