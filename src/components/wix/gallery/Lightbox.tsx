"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { editableField } from "@/lib/cms/sdk";
import type { GalleryItem } from "./types";

interface Props {
  items: GalleryItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  /** items are CMS `photo` documents (item.id = document id): tag fields for on-page editing */
  editable?: boolean;
}

/** Dark full-screen photo viewer: prev/next arrows, ←/→/Esc keys, click the backdrop to close. */
export function Lightbox({ items, index, onIndex, onClose, editable }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = items.length;
  const item = items[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && count > 1) onIndex((index - 1 + count) % count);
      else if (e.key === "ArrowRight" && count > 1) onIndex((index + 1) % count);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, count, onIndex, onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, []);

  if (!item) return null;
  const { image } = item;
  const label = item.title || image.alt || "Photo";
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const edit = (field: string) => (editable ? editableField(item.id, field) : {});

  return createPortal(
    <div className="wix-gallery-lightbox" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <button ref={closeRef} type="button" className="wix-gallery-lightbox-close" aria-label="Close" onClick={onClose}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M4 4l16 16M20 4 4 20" /></svg>
      </button>
      {count > 1 && (
        <button type="button" className="wix-gallery-lightbox-arrow wix-gallery-lightbox-prev" aria-label="Previous photo" onClick={(e) => { stop(e); onIndex((index - 1 + count) % count); }}>
          <svg width="23" height="39" viewBox="0 0 23 39" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M21 1 2 19.5 21 38" /></svg>
        </button>
      )}
      <figure className="wix-gallery-lightbox-figure" onClick={stop}>
        {/* eslint-disable-next-line @next/next/no-img-element -- served from the CMS CDN on purpose */}
        <img
          key={item.id}
          src={image.url}
          srcSet={image.srcset || undefined}
          sizes="(max-width: 979px) 100vw, 90vw"
          alt={label}
          className="wix-gallery-lightbox-img"
          {...edit("image")}
        />
        {(item.title || item.caption || item.year) && (
          <figcaption className="wix-gallery-lightbox-caption">
            {item.title && <p className="wix-gallery-lightbox-title" {...edit("title")}>{item.title}</p>}
            {item.caption && <p {...edit("caption")}>{item.caption}</p>}
            {item.year && <p className="wix-gallery-lightbox-year" {...edit("year")}>{item.year}</p>}
          </figcaption>
        )}
        {count > 1 && <p className="wix-gallery-lightbox-count">{index + 1} / {count}</p>}
      </figure>
      {count > 1 && (
        <button type="button" className="wix-gallery-lightbox-arrow wix-gallery-lightbox-next" aria-label="Next photo" onClick={(e) => { stop(e); onIndex((index + 1) % count); }}>
          <svg width="23" height="39" viewBox="0 0 23 39" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M2 1l19 18.5L2 38" /></svg>
        </button>
      )}
    </div>,
    document.body,
  );
}
