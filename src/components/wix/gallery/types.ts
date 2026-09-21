import type { Photo, SiteImage } from "@/lib/content/types";

/** The slice of a photo the client-side grid + lightbox need (keeps the RSC payload small). */
export interface GalleryItem {
  /** unique key; for `photo` documents this is the CMS document id */
  id: string;
  image: SiteImage;
  title?: string;
  caption?: string;
  year?: number;
  /** short names of the people tagged; only sent in edit mode (tile labels) */
  people?: string[];
}

/** Featured photos first, then CMS order (the incoming order). */
export function orderPhotos(photos: Photo[]): Photo[] {
  return [...photos.filter((p) => p.featured), ...photos.filter((p) => !p.featured)];
}

/**
 * Maps photos to grid items, dropping everything the client doesn't need (the gallery holds
 * 1,000+ photos and the whole list rides in the RSC payload): no originalUrl, no empty keys,
 * no alt/caption that merely repeat the title. The item id is the CMS document id.
 */
export function toGalleryItems(photos: Photo[], names?: Map<string, string>): GalleryItem[] {
  return photos.map((p) => {
    const { url, srcset, width, height, alt, position } = p.image;
    const image: SiteImage = { url };
    if (srcset) image.srcset = srcset;
    if (width && height) { image.width = width; image.height = height; }
    if (alt && alt !== p.title) image.alt = alt;
    if (position) image.position = position;
    const item: GalleryItem = { id: p._id, image };
    if (p.title) item.title = p.title;
    if (p.caption && p.caption !== p.title) item.caption = p.caption;
    if (p.year !== undefined) item.year = p.year;
    if (names) item.people = (p.peopleIds ?? []).map((id) => names.get(id)).filter((n): n is string => !!n);
    return item;
  });
}
