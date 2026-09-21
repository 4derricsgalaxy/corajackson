"use client";

import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { CmsImage } from "@/components/ui/CmsImage";
import { editableField } from "@/lib/cms/sdk";
import { Lightbox } from "./Lightbox";
import type { GalleryItem } from "./types";

interface Props {
  items: GalleryItem[];
  /** Photos revealed initially and per "Show More" click. The original showed 3 rows of 5. */
  pageSize?: number;
  /** "grid" = the 5-column Wix gallery (182x155 tiles); "thumbs" = a wrapping row of 133x133 thumbs */
  variant?: "grid" | "thumbs";
  /** items are CMS `photo` documents — in edit mode a tile click opens the whole entry (field ""); the lightbox edits image/title/caption */
  editable?: boolean;
  /** Snackbox edit mode: no "Show More" paging, and a label (title + people tagged) under each tile */
  editing?: boolean;
  className?: string;
}

/** The original Wix pro-gallery: square-cornered cover tiles, a "Show More" text link, and a lightbox. */
export function GalleryGrid({ items, pageSize = 15, variant = "grid", editable, editing, className }: Props) {
  const [visible, setVisible] = useState(pageSize);
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const shown = variant === "thumbs" || editing ? items : items.slice(0, visible);
  const hasMore = shown.length < items.length;
  const [w, h] = variant === "thumbs" ? [133, 133] : [182, 155];

  return (
    <div className={className}>
      <ul className={clsx(variant === "thumbs" ? "wix-gallery-thumbs" : "wix-gallery-grid", editing && "is-editing")}>
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
                edit={editable ? editableField(item.id, "") : undefined}
              />
            </button>
            {editing && (
              <p className="wix-gallery-label">
                <span {...editableField(item.id, "title")}>{item.title || "(no title)"}</span>
                <span className={clsx("wix-gallery-label-people", !item.people?.length && "is-empty")} {...editableField(item.id, "people")}>
                  {item.people?.length ? item.people.join(", ") : "No one tagged"}
                </span>
              </p>
            )}
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
