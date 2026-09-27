import type { CSSProperties } from "react";

/**
 * Real cropping for CMS images. The Snackbox image editor stores a crop (and an optional hotspot) on the
 * field value as fractions of the picture; the media CDN has no transforms, so the crop is done in CSS
 * on the <img> itself: object-fit: cover picks a base window, `scale` zooms into the cropped area and
 * clip-path trims the zoomed picture back to the element's own box. Nothing around the image moves.
 */
export interface ImageCrop { left: number; top: number; width: number; height: number }
export interface ImageFocus { x: number; y: number }

const frac = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const pct = (n: number) => `${Math.round(n * 10000) / 100}%`;

/** A usable crop (fractions, inside the picture, smaller than the whole) or undefined. */
export function cleanCrop(v: unknown): ImageCrop | undefined {
  if (!v || typeof v !== "object") return undefined;
  const { left, top, width, height } = v as Record<string, unknown>;
  if (!frac(left) || !frac(top) || !frac(width) || !frac(height) || width < 0.01 || height < 0.01) return undefined;
  if (width > 0.995 && height > 0.995) return undefined;
  return { left, top, width: Math.min(width, 1 - left), height: Math.min(height, 1 - top) };
}

export function cleanFocus(v: unknown): ImageFocus | undefined {
  if (!v || typeof v !== "object") return undefined;
  const { x, y } = v as Record<string, unknown>;
  return frac(x) && frac(y) ? { x, y } : undefined;
}

/**
 * Style for an <img> shown in a box of `frameAspect` (width / height) with object-fit: cover, so the
 * box shows the crop (centered on the hotspot when there is one). Undefined when there is no crop or
 * the picture's size is unknown; the caller then keeps its plain object-position.
 */
export function cropStyle(
  img: { crop?: ImageCrop; focus?: ImageFocus; width?: number | null; height?: number | null } | null | undefined,
  frameAspect: number,
): CSSProperties | undefined {
  const c = img?.crop;
  if (!c || !img?.width || !img?.height || !(frameAspect > 0)) return undefined;
  const sa = img.width / img.height;
  // windows as fractions of the picture: the full-picture cover, then the largest box-shaped window inside the crop
  const baseH = Math.min(1, sa / frameAspect);
  const baseW = (baseH * frameAspect) / sa;
  const winH = Math.min(c.height, (c.width * sa) / frameAspect);
  const winW = (winH * frameAspect) / sa;
  const s = baseH / winH;
  if (!(s > 1.001)) return undefined;
  const cx = img.focus?.x ?? c.left + c.width / 2;
  const cy = img.focus?.y ?? c.top + c.height / 2;
  const axis = (center: number, start: number, size: number, win: number, base: number) => {
    const w0 = clamp(clamp(center - win / 2, start, start + size - win), 0, 1 - win); // shown window start
    const b0 = clamp(w0 + win / 2 - base / 2, 0, 1 - base); // base (cover) window start
    const position = base < 1 ? b0 / (1 - base) : 0.5;
    const origin = clamp((w0 - b0) / (base - win), 0, 1);
    return { position, origin };
  };
  const x = axis(cx, c.left, c.width, winW, baseW);
  const y = axis(cy, c.top, c.height, winH, baseH);
  const k = 1 - 1 / s; // share of the zoomed picture outside the box
  return {
    objectFit: "cover",
    objectPosition: `${pct(x.position)} ${pct(y.position)}`,
    scale: String(Math.round(s * 10000) / 10000),
    transformOrigin: `${pct(x.origin)} ${pct(y.origin)}`,
    clipPath: `inset(${pct(y.origin * k)} ${pct((1 - x.origin) * k)} ${pct((1 - y.origin) * k)} ${pct(x.origin * k)})`,
  };
}
