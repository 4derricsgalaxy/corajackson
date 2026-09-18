import type { Metadata } from "next";
import Link from "next/link";
import { CmsImage } from "@/components/ui/CmsImage";
import { getFamilyGraph, getPhotos } from "@/lib/content/queries";
import { albumsFor } from "@/lib/albums";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Gallery", description: "Family photographs, organized by family line." };

export default async function GalleryPage() {
  const [graph, photos] = await Promise.all([getFamilyGraph(), getPhotos()]);
  const albums = albumsFor(graph, photos);
  return (
    <div className="mx-auto max-w-7xl px-5 pb-20 pt-8 md:px-8">
      <p className="eyebrow">Gallery</p>
      <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[1] md:text-6xl">{photos.length.toLocaleString()} photographs, <em className="text-gold">one album per line.</em></h1>
      <p className="mt-5 max-w-xl text-lg text-ink-2">Albums load a few dozen photos at a time so the page stays quick. Add photos in the CMS and tag the people in them to file them here automatically.</p>
      <div className="mt-14 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {albums.map((a, i) => (
          <Link key={a.slug} href={`/gallery/${a.slug}`} className="group rise" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="relative grid aspect-square grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-md bg-paper-3 p-1">
              {a.covers.slice(0, 4).map((src, j) => (
                <div key={j} className="overflow-hidden">
                  <CmsImage src={src} alt="" width={240} height={240} sizes="(max-width: 768px) 25vw, 12vw" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                </div>
              ))}
              <span className="absolute left-0 top-0 h-full w-1" style={{ background: a.color }} />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <p className="font-display text-xl">{a.title}</p>
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">{a.count} photos</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
