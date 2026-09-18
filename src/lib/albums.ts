import type { FamilyGraph } from "./content/queries";
import type { Photo, SiteImage } from "./content/types";
import { lineColor } from "./tree-layout";

export interface Album {
  slug: string;
  title: string;
  color: string;
  count: number;
  covers: SiteImage[];
  photos: Photo[];
  memberSlug?: string;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**
 * Groups photos into albums: one per family line (by `lineage` reference or by
 * tagged people), plus Cora's own album and any custom `album` labels.
 */
export function albumsFor(graph: FamilyGraph, photos: Photo[]): Album[] {
  const lineOf = new Map<string, string>(); // memberId -> line head id
  for (const n of graph.all) {
    const head = n.depth === 0 ? n : n.lineSlug ? graph.bySlug.get(n.lineSlug) : undefined;
    if (head) lineOf.set(n._id, head._id);
  }
  const buckets = new Map<string, Photo[]>();
  const push = (key: string, p: Photo) => { const arr = buckets.get(key) ?? []; if (!arr.includes(p)) { arr.push(p); buckets.set(key, arr); } };

  for (const p of photos) {
    let filed = false;
    if (p.lineageId) { push(p.lineageId, p); filed = true; }
    for (const id of p.peopleIds ?? []) { const head = lineOf.get(id); if (head) { push(head, p); filed = true; } }
    if (p.album) { push(`album:${p.album}`, p); filed = true; }
    if (!filed) push("album:Family", p);
  }

  const albums: Album[] = [];
  const heads = graph.root ? [graph.root, ...graph.lines] : graph.lines;
  heads.forEach((h, i) => {
    const ps = buckets.get(h._id) ?? [];
    if (!ps.length) return;
    albums.push({
      slug: h.slug,
      title: h.nickname ?? h.title.split(" ")[0],
      color: h.depth === 0 ? "#c39a4a" : lineColor(i - 1, h.accentColor),
      count: ps.length,
      covers: ps.slice(0, 4).map((p) => p.image),
      photos: ps,
      memberSlug: h.slug,
    });
    buckets.delete(h._id);
  });
  for (const [key, ps] of buckets) {
    if (!key.startsWith("album:")) continue;
    const title = key.slice(6);
    albums.push({ slug: slugify(title) || "misc", title, color: "#7c745f", count: ps.length, covers: ps.slice(0, 4).map((p) => p.image), photos: ps });
  }
  return albums;
}
