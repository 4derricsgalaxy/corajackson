import Link from "next/link";
import { clsx } from "clsx";
import { WixCanvas } from "@/components/wix/WixCanvas";
import { FamilyTreeButton, FooterLabel, HomeButton, footerLabelText } from "@/components/wix/WixNav";
import type { Album } from "@/lib/albums";
import { pd } from "@/lib/design/keys";
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
  /** Snackbox edit mode: whole album at once, title + tagged names under every tile */
  editing?: boolean;
}

/**
 * The original Wix gallery page: home icon on top, 5-column photo grid, "Show More",
 * the Family Tree pill and the footer label. Shared by /gallery and /gallery/[album].
 */
export function GalleryShell({ items, albums, current, title, footerText, editing }: Props) {
  const t = pd();
  return (
    <WixCanvas path={current ? `/gallery/${current}` : "/gallery"} minHeight={676} className={clsx("wix-gallery-page", footerLabelText(footerText).length > 40 && "wix-gallery-long-footer")}>
      <div className="wix-gallery-top">
        <HomeButton large piece={t("btn-home", undefined, "Home button")} />
        {title && <h1 className="wix-h2 wix-gallery-title" {...t("title", undefined, "Album title")}>{title}</h1>}
        {albums.length > 0 && (
          <nav aria-label="Albums" className="wix-gallery-filter" {...t("albums", undefined, "Album links")}>
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
        <GalleryGrid key={current ?? "all"} items={items} editable editing={editing} className="wix-gallery-body" piece={t("gallery", undefined, "Photo grid")} />
      ) : (
        <p className="wix-gallery-empty" {...t("empty", undefined, "No photos text")}>Family photos will appear here.</p>
      )}
      <div className="wix-gallery-nav" {...t("btn-tree", undefined, "Family Tree button")}>
        <FamilyTreeButton />
      </div>
      <FooterLabel text={footerText} layout={t("footer")} />
    </WixCanvas>
  );
}
