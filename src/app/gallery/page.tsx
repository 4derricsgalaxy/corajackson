import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { GalleryShell } from "@/components/wix/gallery/GalleryShell";
import { orderPhotos, toGalleryItems } from "@/components/wix/gallery/types";
import { getFamilyGraph, getPhotos, getSettings } from "@/lib/content/queries";
import { albumsFor } from "@/lib/albums";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Gallery", description: "Family photographs, organized by family line." };

export default async function GalleryPage() {
  const [graph, photos, settings] = await Promise.all([getFamilyGraph(), getPhotos(), getSettings()]);
  const albums = albumsFor(graph, photos);
  const editing = (await draftMode()).isEnabled;
  const names = editing ? new Map([...graph.byId.values()].map((m) => [m._id, m.nickname ?? m.title.split(" ")[0]])) : undefined;
  return <GalleryShell items={toGalleryItems(orderPhotos(photos), names)} albums={albums} footerText={settings.footerText} editing={editing} />;
}
