import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { PhotoDrop } from "@/components/photos/PhotoDrop";
import { GalleryShell } from "@/components/wix/gallery/GalleryShell";
import { orderPhotos, toGalleryItems } from "@/components/wix/gallery/types";
import { getFamilyGraph, getPhotos, getSettings } from "@/lib/content/queries";
import { albumsFor } from "@/lib/albums";

export const revalidate = 3600;

export async function generateStaticParams() {
  const [graph, photos] = await Promise.all([getFamilyGraph(), getPhotos()]);
  return albumsFor(graph, photos).map((a) => ({ album: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ album: string }> }): Promise<Metadata> {
  const { album } = await params;
  const [graph, photos] = await Promise.all([getFamilyGraph(), getPhotos()]);
  const a = albumsFor(graph, photos).find((x) => x.slug === album);
  return a ? { title: `${a.title} · Gallery` } : {};
}

export default async function AlbumPage({ params }: { params: Promise<{ album: string }> }) {
  const { album } = await params;
  const [graph, photos, settings] = await Promise.all([getFamilyGraph(), getPhotos(), getSettings()]);
  const albums = albumsFor(graph, photos);
  const a = albums.find((x) => x.slug === album);
  if (!a) notFound();
  const editing = (await draftMode()).isEnabled;
  const names = editing ? new Map([...graph.byId.values()].map((m) => [m._id, m.nickname ?? m.title.split(" ")[0]])) : undefined;
  // a family's album (or Cora's) takes dropped photos in edit mode: they are filed under that family line
  const head = a.memberSlug ? graph.bySlug.get(a.memberSlug) : undefined;
  return (
    <>
    {editing && head && <PhotoDrop target={{ kind: "line", id: head._id, name: a.title }} />}
    <GalleryShell
      items={toGalleryItems(orderPhotos(a.photos), names)}
      editing={editing}
      albums={albums}
      current={a.slug}
      title={a.title}
      footerText={settings.footerText}
    />
    </>
  );
}
