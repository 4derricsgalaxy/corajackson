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

  // t = title, p = people tagged in it (from the Photos entry's "People pictured"; a portrait is its person)
  type Pic = { t: string; p: string[]; u: string; s?: string; w?: number | null; h?: number | null };
  const byUrl = new Map<string, Pic>();
  const add = (t: string, people: string[], img?: { url?: string; srcset?: string; width?: number | null; height?: number | null } | null) => {
    if (!img?.url) return;
    const had = byUrl.get(img.url);
    if (had) {
      had.p = [...new Set([...had.p, ...people])];
      return;
    }
    byUrl.set(img.url, { t, p: people, u: img.url, s: img.srcset, w: img.width, h: img.height });
  };
  const nameOf = (id: string) => {
    const m = graph.byId.get(id);
    return m ? (m.nickname && m.nickname !== m.title ? `${m.title} (${m.nickname})` : m.title) : undefined;
  };
  for (const m of graph.all) {
    const who = [nameOf(m._id) ?? m.title];
    add(`${m.title} (portrait)`, who, m.portrait);
    add(`${m.title} (childhood)`, who, m.treePhoto);
    add(`${m.title} (page background)`, [], m.heroImage);
  }
  for (const p of photos) add(p.title, (p.peopleIds ?? []).map(nameOf).filter((n): n is string => Boolean(n)), p.image);
  const pictures = [...byUrl.values()];

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
