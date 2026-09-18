import type { NavData } from "@/components/layout/nav-data";
import { descendantCount, getFamilyGraph, getSettings } from "./content/queries";
import { lineColor } from "./tree-layout";

export async function buildNavData(): Promise<NavData> {
  const [graph, settings] = await Promise.all([getFamilyGraph(), getSettings()]);
  const lines = graph.lines.map((l, i) => ({
    slug: l.slug,
    title: l.title,
    nickname: l.nickname,
    portrait: l.portrait,
    descendants: descendantCount(l),
    color: lineColor(i, l.accentColor),
    children: l.children.map((c) => ({ slug: c.slug, title: c.title })),
  }));
  const lineTitle = new Map(graph.lines.map((l) => [l.slug, l.nickname ?? l.title.split(" ")[0]]));
  const people = graph.all.map((p) => ({
    slug: p.slug,
    title: p.title,
    nickname: p.nickname,
    lineSlug: p.lineSlug,
    lineTitle: p.lineSlug ? lineTitle.get(p.lineSlug) : undefined,
    generation: p.depth,
    portrait: p.portrait,
  }));
  return { siteTitle: settings.title, lines, people, rootSlug: graph.root?.slug };
}
