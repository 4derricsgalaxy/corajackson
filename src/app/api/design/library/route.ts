import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/cms/editor-auth";
import { albumsFor } from "@/lib/albums";
import { getFamilyGraph, getPhotos, getStories } from "@/lib/content/queries";

// Design tool: the family's pictures (for "Add picture" and page backgrounds) and every page of the site
// (for "Copy design to other pages").

export async function GET() {
  const editor = await requireEditor("designs");
  if (editor instanceof NextResponse) return editor;
  const [graph, photos, stories] = await Promise.all([getFamilyGraph(), getPhotos(), getStories()]);

  const pictures: { t: string; u: string; s?: string; w?: number | null; h?: number | null }[] = [];
  const seen = new Set<string>();
  const add = (t: string, img?: { url?: string; srcset?: string; width?: number | null; height?: number | null } | null) => {
    if (!img?.url || seen.has(img.url)) return;
    seen.add(img.url);
    pictures.push({ t, u: img.url, s: img.srcset, w: img.width, h: img.height });
  };
  for (const m of graph.all) {
    add(`${m.title} (portrait)`, m.portrait);
    add(`${m.title} (childhood)`, m.treePhoto);
    add(`${m.title} (page background)`, m.heroImage);
  }
  for (const p of photos) add(p.title, p.image);

  const pages = [
    { path: "/", title: "Home", group: "Main pages" },
    { path: "/family", title: "Meet the Family", group: "Main pages" },
    { path: "/family-tree", title: "Family Tree", group: "Main pages" },
    { path: "/gallery", title: "Gallery (all photos)", group: "Main pages" },
    { path: "/history", title: "History", group: "Main pages" },
    { path: "/stories", title: "Stories", group: "Main pages" },
    ...graph.all.map((m) => ({ path: `/family/${m.slug}`, title: m.title, group: "Family pages" })),
    ...albumsFor(graph, photos).map((a) => ({ path: `/gallery/${a.slug}`, title: a.title, group: "Photo albums" })),
    ...stories.map((s) => ({ path: `/stories/${s.slug}`, title: s.title, group: "Stories" })),
  ];
  return NextResponse.json({ pictures, pages }, { headers: { "Cache-Control": "no-store" } });
}
