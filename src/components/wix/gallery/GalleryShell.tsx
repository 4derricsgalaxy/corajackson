import Link from "next/link";
import { clsx } from "clsx";
import { WixCanvas } from "@/components/wix/WixCanvas";
import { FamilyTreeButton, FooterLabel, HomeButton, footerLabelText } from "@/components/wix/WixNav";
import type { Album } from "@/lib/albums";
import { GalleryGrid } from "./GalleryGrid";
import type { GalleryItem } from "./types";

interface Props {
  items: GalleryItem[];
  albums: Album[];
  /** slug of the album being shown; undefined on the "All" gallery */
  current?: string;
  /** album title, shown as a centered heading under the home icon */
  title?: string;
  footerText?: string;
}

/**
 * The original Wix gallery page: home icon on top, 5-column photo grid, "Show More",
 * the Family Tree pill and the footer label. Shared by /gallery and /gallery/[album].
 */
export function GalleryShell({ items, albums, current, title, footerText }: Props) {
  return (
    <WixCanvas minHeight={676} className={clsx("wix-gallery-page", footerLabelText(footerText).length > 40 && "wix-gallery-long-footer")}>
      <div className="wix-gallery-top">
        <HomeButton large />
        {title && <h1 className="wix-h2 wix-gallery-title">{title}</h1>}
        {albums.length > 0 && (
          <nav aria-label="Albums" className="wix-gallery-filter">
            <Link href="/gallery" className={clsx("wix-text-link", !current && "is-current")} aria-current={!current ? "page" : undefined}>
              {current ? "All photos" : "All"}
            </Link>
            {albums.map((a) => (
              <span key={a.slug}>
                <span aria-hidden className="wix-gallery-filter-dot">·</span>
                <Link href={`/gallery/${a.slug}`} className={clsx("wix-text-link", current === a.slug && "is-current")} aria-current={current === a.slug ? "page" : undefined}>
                  {a.title}
                </Link>
              </span>
            ))}
          </nav>
        )}
      </div>
      {items.length > 0 ? (
        <GalleryGrid key={current ?? "all"} items={items} editable className="wix-gallery-body" />
      ) : (
        <p className="wix-gallery-empty">Family photos will appear here.</p>
      )}
      <div className="wix-gallery-nav">
        <FamilyTreeButton />
      </div>
      <FooterLabel text={footerText} />
    </WixCanvas>
  );
}
