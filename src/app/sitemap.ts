import type { MetadataRoute } from "next";
import { getFamilyGraph, getPhotos, getStories } from "@/lib/content/queries";
import { albumsFor } from "@/lib/albums";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [graph, stories, photos] = await Promise.all([getFamilyGraph(), getStories(), getPhotos()]);
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, priority: 1 },
    { url: `${base}/family-tree`, lastModified: now, priority: 0.9 },
    { url: `${base}/family`, lastModified: now, priority: 0.9 },
    { url: `${base}/gallery`, lastModified: now, priority: 0.7 },
    { url: `${base}/history`, lastModified: now, priority: 0.6 },
    { url: `${base}/stories`, lastModified: now, priority: 0.6 },
    ...graph.all.map((m) => ({ url: `${base}/family/${m.slug}`, lastModified: now, priority: m.depth <= 1 ? 0.8 : 0.5 })),
    ...albumsFor(graph, photos).map((a) => ({ url: `${base}/gallery/${a.slug}`, lastModified: now, priority: 0.5 })),
    ...stories.map((s) => ({ url: `${base}/stories/${s.slug}`, lastModified: now, priority: 0.5 })),
  ];
}
