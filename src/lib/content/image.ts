import type { NestedImage, SiteImage } from "./types";
import { imagePosition, type ImageValue } from "../cms/sdk";
import { parseCmsImage, wixImageUrl } from "../wix/media";

/** Included Snackbox asset → SiteImage. Accepts an unresolved {_ref} (returns undefined). */
export function fromCms(value: unknown): SiteImage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as ImageValue & { _id?: string; _ref?: string; srcset?: string; originalUrl?: string; width?: number | null; height?: number | null };
  if (!v.url) return undefined;
  return {
    assetId: v._id ?? v._ref,
    url: v.url,
    srcset: v.srcset || undefined,
    originalUrl: v.originalUrl,
    width: v.width ?? null,
    height: v.height ?? null,
    alt: v.alt ?? null,
    position: imagePosition(v),
  };
}

/** An image value stored inside a list item: keep the asset id even when no url was saved with it. */
export function nestedFromCms(value: unknown): NestedImage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as ImageValue & { _id?: string; _ref?: string };
  const assetId = v._ref ?? v._id;
  if (!assetId && !v.url) return undefined;
  return { assetId, url: v.url || undefined, alt: v.alt ?? null, position: imagePosition(v) };
}

/** Finish a nested image: the fully resolved asset (srcset, size) when the site has it, else the url saved with it. */
export function resolveImage(img: NestedImage | undefined, assets: Map<string, SiteImage>): SiteImage | undefined {
  if (!img) return undefined;
  const full = img.assetId ? assets.get(img.assetId) : undefined;
  if (full) return { ...full, alt: img.alt || full.alt, position: img.position ?? full.position };
  return img.url ? { url: img.url, alt: img.alt, position: img.position, assetId: img.assetId } : undefined;
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
