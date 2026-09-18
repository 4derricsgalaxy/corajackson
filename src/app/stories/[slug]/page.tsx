import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RichText } from "@/components/ui/RichText";
import { CmsImage } from "@/components/ui/CmsImage";
import { PhotoGrid } from "@/components/family/PhotoGrid";
import { getFamilyGraph, getStories } from "@/lib/content/queries";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getStories()).map((s) => ({ slug: s.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = (await getStories()).find((x) => x.slug === slug);
  return s ? { title: s.title, description: s.excerpt } : {};
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [stories, graph] = await Promise.all([getStories(), getFamilyGraph()]);
  const idx = stories.findIndex((x) => x.slug === slug);
  const story = stories[idx];
  if (!story) notFound();
  const people = (story.peopleIds ?? []).map((id) => graph.byId.get(id)).filter(Boolean);
  const author = story.authorId ? graph.byId.get(story.authorId) : undefined;
  const next = stories[idx + 1] ?? stories[0];
  return (
    <article className="mx-auto max-w-3xl px-5 pb-24 pt-6 md:px-8">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/stories", label: "Stories" }, { label: story.title }]} />
      <h1 className="mt-8 font-display text-5xl leading-[1] md:text-6xl">{story.title}</h1>
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-3">
        {story.authorName || author ? <>Told by {author ? <Link className="underline" href={`/family/${author.slug}`}>{author.title}</Link> : story.authorName}</> : null}
        {story.storyDate ? ` · ${story.storyDate.slice(0, 4)}` : ""}
      </p>
      {story.coverImage && <div className="frame mt-10 -rotate-1"><CmsImage src={story.coverImage} alt={story.title} width={880} height={600} priority sizes="(max-width: 768px) 92vw, 720px" className="h-full w-full object-cover" /></div>}
      <div className="mt-12"><RichText content={story.body} /></div>
      {people.length > 0 && (
        <div className="mt-12 border-t border-line pt-6">
          <p className="eyebrow mb-3">People in this story</p>
          <div className="flex flex-wrap gap-2">
            {people.map((p) => p && <Link key={p._id} href={`/family/${p.slug}`} className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-sm transition hover:border-gold"><span className="h-7 w-7 overflow-hidden rounded-full"><CmsImage src={p.portrait} alt="" width={56} height={56} className="h-full w-full object-cover" /></span>{p.title}</Link>)}
          </div>
        </div>
      )}
      {story.gallery && story.gallery.length > 0 && <div className="mt-12"><PhotoGrid photos={story.gallery.map((img, i) => ({ _id: `g${i}`, image: img }))} pageSize={12} /></div>}
      {next && next._id !== story._id && (
        <Link href={`/stories/${next.slug}`} className="mt-16 block rounded-xl border border-line p-6 transition hover:border-gold"><p className="eyebrow">Next story</p><p className="mt-2 font-display text-2xl">{next.title}</p></Link>
      )}
    </article>
  );
}
