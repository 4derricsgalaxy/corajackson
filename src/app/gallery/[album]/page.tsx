import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  return (
    <GalleryShell
      items={toGalleryItems(orderPhotos(a.photos))}
      albums={albums}
      current={a.slug}
      title={a.title}
      footerText={settings.footerText}
    />
  );
}
