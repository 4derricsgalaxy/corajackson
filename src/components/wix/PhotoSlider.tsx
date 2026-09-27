"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { editableField } from "@/lib/cms/sdk";
import { cropAttr, type ImageCrop } from "@/lib/content/crop";

export interface SliderPhoto {
  key: string;
  /** thumbnail / default src */
  url: string;
  srcset?: string;
  /** largest available URL, used by the lightbox */
  fullUrl?: string;
  alt: string;
  caption?: string;
  /** CSS object-position honoring the CMS hotspot */
  position?: string;
  /** the CMS crop for the square thumbnail (cropStyle); replaces `position` when set */
  cropStyle?: CSSProperties;
  /** the saved crop itself, for the on-page Crop tool */
  crop?: ImageCrop;
  /** CMS entry this picture comes from; in edit mode a click opens it (field "" = the whole entry) */
  edit?: { docId: string; field: string };
}

const editAttrs = (p: SliderPhoto) => (p.edit ? editableField(p.edit.docId, p.edit.field) : {});

const THUMB = 133;
const GAP = 15;
/** hover-scroll speed in px per second: a slow, easy pace, a thumbnail every ~2 seconds */
const HOVER_SPEED = 70;
/** after an arrow click, let its smooth page-scroll finish before hover-scrolling resumes */
const CLICK_PAUSE_MS = 700;

function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg width="23" height="39" viewBox="0 0 23 39" fill="none" aria-hidden>
      <path d={dir === "prev" ? "M20 2 3 19.5 20 37" : "M3 2l17 17.5L3 37"} stroke="#fff" strokeWidth="4" />
    </svg>
  );
}

/** The original Wix "slider gallery": a strip of square thumbs with chevrons, plus a simple lightbox. */
export function PhotoSlider({ photos, label = "Photos" }: { photos: SliderPhoto[]; label?: string }) {
  const windowRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const el = windowRef.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [photos.length]);

  // Hovering a chevron with a mouse glides the strip that way until the pointer leaves or the end is reached.
  const hover = useRef<{ dir: 1 | -1; raf: number; last: number; pos: number; pauseUntil: number } | null>(null);

  const stopHover = useCallback(() => {
    const h = hover.current;
    if (!h) return;
    cancelAnimationFrame(h.raf);
    hover.current = null;
    windowRef.current?.classList.remove("wix-slider-gliding");
  }, []);

  const startHover = (dir: 1 | -1, e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = windowRef.current;
    if (!el) return;
    stopHover();
    el.classList.add("wix-slider-gliding"); // snap points would fight the tiny per-frame steps
    const h = { dir, raf: 0, last: performance.now(), pos: el.scrollLeft, pauseUntil: 0 };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - h.last) / 1000);
      h.last = now;
      if (now >= h.pauseUntil) {
        // pick up any scroll that happened meanwhile (arrow click, wheel, keyboard)
        if (Math.abs(el.scrollLeft - h.pos) > 2) h.pos = el.scrollLeft;
        const max = el.scrollWidth - el.clientWidth;
        h.pos = Math.max(0, Math.min(max, h.pos + h.dir * HOVER_SPEED * dt));
        el.scrollLeft = h.pos;
      }
      h.raf = requestAnimationFrame(tick);
    };
    h.raf = requestAnimationFrame(tick);
    hover.current = h;
  };

  useEffect(() => stopHover, [stopHover]);

  const page = (dir: 1 | -1) => {
    const el = windowRef.current;
    if (!el) return;
    if (hover.current) hover.current.pauseUntil = performance.now() + CLICK_PAUSE_MS;
    const step = Math.max(1, Math.floor((el.clientWidth + GAP) / (THUMB + GAP))) * (THUMB + GAP);
    const max = el.scrollWidth - el.clientWidth;
    // at either end the strip wraps around (an instant jump: a smooth scroll across the whole strip is dizzying)
    if (dir === 1 && el.scrollLeft >= max - 2) { el.scrollTo({ left: 0, behavior: "auto" }); return; }
    if (dir === -1 && el.scrollLeft <= 2) { el.scrollTo({ left: max, behavior: "auto" }); return; }
    const target = el.scrollLeft + dir * step;
    el.scrollTo({ left: Math.max(0, Math.min(max, target)), behavior: "smooth" });
  };

  if (!photos.length) return null;

  return (
    <div className="wix-slider" role="group" aria-label={label}>
      {overflowing && (
        <button type="button" className="wix-slider-arrow wix-slider-prev" aria-label="Previous photos" onClick={() => page(-1)} onPointerEnter={(e) => startHover(-1, e)} onPointerLeave={stopHover}>
          <Chevron dir="prev" />
        </button>
      )}
      <div ref={windowRef} className="wix-slider-window scrollbar-none">
        <ul className="wix-slider-track">
          {photos.map((p, i) => (
            <li key={p.key}>
              <button type="button" className="wix-slider-thumb" aria-label={`Open photo: ${p.caption || p.alt || i + 1}`} onClick={() => setOpen(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- served from the CMS CDN on purpose */}
                <img
                  src={p.url}
                  srcSet={p.srcset}
                  sizes={`${THUMB}px`}
                  width={THUMB}
                  height={THUMB}
                  alt={p.alt}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  style={p.cropStyle ?? (p.position ? { objectPosition: p.position } : undefined)}
                  {...cropAttr(p.crop)}
                  {...editAttrs(p)}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {overflowing && (
        <button type="button" className="wix-slider-arrow wix-slider-next" aria-label="More photos" onClick={() => page(1)} onPointerEnter={(e) => startHover(1, e)} onPointerLeave={stopHover}>
          <Chevron dir="next" />
        </button>
      )}
      {open !== null && <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Lightbox({ photos, index, onIndex, onClose }: { photos: SliderPhoto[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const many = photos.length > 1;
  const photo = photos[index];

  const go = useCallback((d: number) => onIndex((index + d + photos.length) % photos.length), [index, photos.length, onIndex]);

  // focus management + scroll lock, once per open
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowRight" && many) go(1);
      else if (e.key === "ArrowLeft" && many) go(-1);
      else if (e.key === "Tab") {
        const nodes = dialogRef.current?.querySelectorAll<HTMLElement>("button");
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (!dialogRef.current?.contains(active)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, many, onClose]);

  if (!photo) return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="wix-slider-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || photo.alt || "Photo"}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <button ref={closeRef} type="button" className="wix-slider-lb-close" aria-label="Close" onClick={onClose}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden><path d="M2 2l18 18M20 2 2 20" stroke="#fff" strokeWidth="2.5" /></svg>
      </button>
      {many && (
        <button type="button" className="wix-slider-arrow wix-slider-lb-prev" aria-label="Previous photo" onClick={() => go(-1)}>
          <Chevron dir="prev" />
        </button>
      )}
      <figure className="wix-slider-lb-figure" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- served from the CMS CDN on purpose */}
        <img key={photo.key} src={photo.fullUrl || photo.url} alt={photo.alt} {...editAttrs(photo)} />
        <figcaption>
          {photo.caption && <span className="wix-slider-lb-caption">{photo.caption}</span>}
          {many && <span className="wix-slider-lb-count">{index + 1} / {photos.length}</span>}
        </figcaption>
      </figure>
      {many && (
        <button type="button" className="wix-slider-arrow wix-slider-lb-next" aria-label="Next photo" onClick={() => go(1)}>
          <Chevron dir="next" />
        </button>
      )}
    </div>,
    document.body,
  );
}
