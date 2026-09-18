import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PhotoGrid } from "@/components/family/PhotoGrid";
import { getFamilyGraph, getPhotos } from "@/lib/content/queries";
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
  const [graph, photos] = await Promise.all([getFamilyGraph(), getPhotos()]);
  const albums = albumsFor(graph, photos);
  const a = albums.find((x) => x.slug === album);
  if (!a) notFound();
  const idx = albums.indexOf(a);
  const prev = albums[idx - 1];
  const next = albums[idx + 1];
  return (
    <div className="mx-auto max-w-7xl px-5 pb-20 pt-6 md:px-8">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/gallery", label: "Gallery" }, { label: a.title }]} />
      <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow" style={{ color: a.color }}>Album</p>
          <h1 className="mt-2 font-display text-5xl md:text-6xl">{a.title}</h1>
          <p className="mt-3 text-ink-3">{a.count} photographs{a.memberSlug ? <> · <Link className="link-underline" href={`/family/${a.memberSlug}`}>Visit {a.title}&apos;s page</Link></> : null}</p>
        </div>
        <div className="flex gap-2 text-sm">
          {prev && <Link href={`/gallery/${prev.slug}`} className="rounded-full border border-line px-4 py-2 transition hover:border-gold">← {prev.title}</Link>}
          {next && <Link href={`/gallery/${next.slug}`} className="rounded-full border border-line px-4 py-2 transition hover:border-gold">{next.title} →</Link>}
        </div>
      </div>
      <div className="mt-12">
        <PhotoGrid photos={a.photos} pageSize={24} />
      </div>
    </div>
  );
}
