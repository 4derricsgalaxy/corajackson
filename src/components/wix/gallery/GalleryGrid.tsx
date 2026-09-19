"use client";

import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { CmsImage } from "@/components/ui/CmsImage";
import { Lightbox } from "./Lightbox";
import type { GalleryItem } from "./types";

interface Props {
  items: GalleryItem[];
  /** Photos revealed initially and per "Show More" click. The original showed 3 rows of 5. */
  pageSize?: number;
  /** "grid" = the 5-column Wix gallery (182x155 tiles); "thumbs" = a wrapping row of 133x133 thumbs */
  variant?: "grid" | "thumbs";
  /** items are CMS `photo` documents — enables on-page editing of image/title/caption in the lightbox */
  editable?: boolean;
  className?: string;
}

/** The original Wix pro-gallery: square-cornered cover tiles, a "Show More" text link, and a lightbox. */
export function GalleryGrid({ items, pageSize = 15, variant = "grid", editable, className }: Props) {
  const [visible, setVisible] = useState(pageSize);
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const shown = variant === "thumbs" ? items : items.slice(0, visible);
  const hasMore = shown.length < items.length;
  const [w, h] = variant === "thumbs" ? [133, 133] : [182, 155];

  return (
    <div className={className}>
      <ul className={clsx(variant === "thumbs" ? "wix-gallery-thumbs" : "wix-gallery-grid")}>
        {shown.map((item, i) => (
          <li key={item.id}>
            <button type="button" className="wix-gallery-tile" aria-label={`Open photo${item.title ? `: ${item.title}` : ""}`} onClick={() => setOpen(i)}>
              <CmsImage
                src={item.image}
                alt={item.title || item.image.alt || ""}
                width={w}
                height={h}
                sizes={variant === "thumbs" ? "133px" : "(max-width: 480px) 50vw, (max-width: 979px) 33vw, 182px"}
                priority={variant === "grid" && i < 5}
              />
            </button>
          </li>
        ))}
      </ul>
      {variant === "grid" && (
        <div className="wix-gallery-more-row">
          {hasMore && (
            <button type="button" className="wix-text-link wix-gallery-more" onClick={() => setVisible((v) => v + pageSize)}>
              Show More
            </button>
          )}
        </div>
      )}
      {/* `shown` is a prefix of `items`, so indexes line up; the arrows walk the whole set */}
      {open !== null && <Lightbox items={items} index={open} onIndex={setOpen} onClose={close} editable={editable} />}
    </div>
  );
}
