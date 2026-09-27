import { clsx } from "clsx";
import { cropStyle } from "@/lib/content/crop";
import type { SiteImage } from "@/lib/content/types";

interface Props {
  src?: SiteImage | null;
  alt: string;
  width: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
  /** kept for call-site compatibility; the CMS hotspot drives object-position */
  fit?: "fill" | "fit";
  /** on-page editing attributes (editableField) for the <img> */
  edit?: Record<string, string>;
}

/**
 * Renders a CMS image straight from the media CDN using the srcset the CMS
 * pre-rendered (WebP ladder). No per-request optimizer, no Vercel image quota.
 */
export function CmsImage({ src, alt, width, height, className, priority, sizes, edit }: Props) {
  if (!src?.url) {
    return <div className={clsx("bg-paper-3", className)} aria-hidden style={{ aspectRatio: `${width}/${height ?? width}` }} />;
  }
  const ratio = src.width && src.height ? src.width / src.height : height ? width / height : 4 / 5;
  // a CMS crop: with no fixed height the box takes the crop's shape, then the picture zooms into it
  const cropRatio = src.crop ? (ratio * src.crop.width) / src.crop.height : undefined;
  const h = height ?? Math.round(width / (cropRatio ?? ratio));
  const crop = cropStyle(src, height ? width / height : (cropRatio ?? ratio));
  const style = crop ? { ...crop, ...(height ? {} : { aspectRatio: String(cropRatio) }) } : src.position ? { objectPosition: src.position } : undefined;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- served from the CMS CDN on purpose
    <img
      src={src.url}
      srcSet={src.srcset || undefined}
      sizes={sizes ?? `${width}px`}
      width={width}
      height={h}
      alt={alt || src.alt || ""}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={className}
      style={style}
      {...edit}
    />
  );
}
