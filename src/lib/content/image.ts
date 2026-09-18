import type { SiteImage } from "./types";
import { imagePosition, type ImageValue } from "../cms/sdk";
import { parseCmsImage, wixImageUrl } from "../wix/media";

/** Included Snackbox asset → SiteImage. Accepts an unresolved {_ref} (returns undefined). */
export function fromCms(value: unknown): SiteImage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as ImageValue & { srcset?: string; originalUrl?: string; width?: number | null; height?: number | null };
  if (!v.url) return undefined;
  return {
    url: v.url,
    srcset: v.srcset || undefined,
    originalUrl: v.originalUrl,
    width: v.width ?? null,
    height: v.height ?? null,
    alt: v.alt ?? null,
    position: imagePosition(v),
  };
}

/** Legacy Wix media URI (seed.json) → SiteImage with a CDN srcset. */
export function fromWix(value: unknown, alt?: string): SiteImage | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const ref = parseCmsImage(value);
  if (!ref) return { url: value, alt };
  const w = ref.width ?? 1200;
  const h = ref.height ?? Math.round(w * 1.25);
  const steps = [320, 640, 960, 1280, 1920].filter((s) => s <= Math.max(w, 640));
  return {
    url: wixImageUrl(value, { width: Math.min(w, 1280), height: Math.round(Math.min(w, 1280) * (h / w)), fit: "fit" }),
    srcset: steps.map((s) => `${wixImageUrl(value, { width: s, height: Math.round(s * (h / w)), fit: "fit" })} ${s}w`).join(", "),
    originalUrl: `https://static.wixstatic.com/media/${ref.id}`,
    width: w,
    height: h,
    alt,
  };
}

export function aspectOf(img: SiteImage | null | undefined, fallback = 4 / 5): number {
  if (img?.width && img?.height) return img.width / img.height;
  return fallback;
}

/** Largest available URL, for lightboxes. */
export function fullSrc(img: SiteImage | null | undefined): string {
  return img?.originalUrl ?? img?.url ?? "";
}
