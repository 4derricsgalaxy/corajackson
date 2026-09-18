/**
 * Helpers for Wix Media Manager image references.
 *
 * The CMS stores images either as a Media Manager URI
 *   wix:image://v1/<fileId>/<fileName>#originWidth=W&originHeight=H
 * or as a plain https://static.wixstatic.com/media/<fileId> URL.
 * Both resolve to static.wixstatic.com, which supports on-the-fly resizing.
 */

export interface CmsImageRef {
  id: string;
  name: string;
  width?: number;
  height?: number;
}

const STATIC_BASE = "https://static.wixstatic.com/media/";

export function parseCmsImage(value: string | null | undefined): CmsImageRef | null {
  if (!value) return null;
  if (value.startsWith("wix:image://")) {
    const withoutScheme = value.replace("wix:image://v1/", "");
    const [pathPart, hash = ""] = withoutScheme.split("#");
    const [id, ...rest] = pathPart.split("/");
    const params = new URLSearchParams(hash);
    const width = Number(params.get("originWidth")) || undefined;
    const height = Number(params.get("originHeight")) || undefined;
    return { id, name: decodeURIComponent(rest.join("/") || id), width, height };
  }
  if (value.startsWith(STATIC_BASE)) {
    const tail = value.slice(STATIC_BASE.length);
    const id = tail.split("/")[0];
    return { id, name: id };
  }
  if (/^[a-z0-9]+_[a-f0-9]{32}~mv2\.[a-z0-9]+$/i.test(value)) {
    return { id: value, name: value };
  }
  return null;
}

export type FitMode = "fill" | "fit";

export interface ImageUrlOptions {
  width: number;
  height?: number;
  fit?: FitMode;
  quality?: number;
  focal?: { x: number; y: number };
}

/** Build a resized static URL for a Wix image reference. Falls back to the raw value for external URLs. */
export function wixImageUrl(value: string | null | undefined, opts: ImageUrlOptions): string {
  if (!value) return "";
  const ref = parseCmsImage(value);
  if (!ref) return value;
  const fit = opts.fit ?? "fill";
  const quality = opts.quality ?? 85;
  const height = opts.height ?? Math.round(opts.width * ((ref.height ?? 3) / (ref.width ?? 4)));
  const parts = [`w_${opts.width}`, `h_${height}`, "al_c", `q_${quality}`, "usm_0.66_1.00_0.01", "enc_auto"];
  if (opts.focal && fit === "fill") {
    parts.push(`fp_${opts.focal.x.toFixed(2)}_${opts.focal.y.toFixed(2)}`);
  }
  const fileName = encodeURIComponent(ref.name.replace(/\s+/g, "_"));
  return `${STATIC_BASE}${ref.id}/v1/${fit}/${parts.join(",")}/${fileName}`;
}

/** Original, un-resized static URL. */
export function wixImageOriginalUrl(value: string | null | undefined): string {
  const ref = parseCmsImage(value);
  return ref ? `${STATIC_BASE}${ref.id}` : value ?? "";
}

/** Construct a wix:image URI from a Media Manager file id (used by the seed script). */
export function toCmsImageUri(fileId: string, fileName: string, width?: number, height?: number): string {
  const safeName = encodeURIComponent(fileName || fileId);
  const hash = width && height ? `#originWidth=${width}&originHeight=${height}` : "";
  return `wix:image://v1/${fileId}/${safeName}${hash}`;
}

export function aspectRatio(value: string | null | undefined, fallback = 4 / 5): number {
  const ref = parseCmsImage(value);
  if (ref?.width && ref?.height) return ref.width / ref.height;
  return fallback;
}
