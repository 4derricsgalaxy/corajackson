import type { Metadata } from "next";
import Link from "next/link";
import { CmsImage } from "@/components/ui/CmsImage";
import { getStories } from "@/lib/content/queries";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Stories", description: "Memories and stories told by the Jackson family." };

export default async function StoriesPage() {
  const stories = await getStories();
  const [lead, ...rest] = stories;
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-8 md:px-8">
      <p className="eyebrow">Stories</p>
      <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[1] md:text-6xl">Told around the table, <em className="text-gold">kept here.</em></h1>
      {lead && (
        <Link href={`/stories/${lead.slug}`} className="group mt-14 grid gap-8 rounded-xl border border-line p-5 transition hover:border-gold md:grid-cols-2 md:p-8">
          <div className="frame overflow-hidden"><CmsImage src={lead.coverImage} alt={lead.title} width={720} height={520} sizes="(max-width: 768px) 90vw, 45vw" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" /></div>
          <div className="flex flex-col justify-center">
            <p className="eyebrow">Featured story</p>
            <h2 className="mt-3 font-display text-4xl leading-tight">{lead.title}</h2>
            {lead.excerpt && <p className="mt-4 text-lg text-ink-2">{lead.excerpt}</p>}
            {lead.authorName && <p className="mt-5 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">Told by {lead.authorName}</p>}
          </div>
        </Link>
      )}
      <div className="mt-14 grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
        {rest.map((s, i) => (
          <Link key={s._id} href={`/stories/${s.slug}`} className="group rise" style={{ animationDelay: `${i * 60}ms` }}>
            {s.coverImage && <div className="frame aspect-[4/3] overflow-hidden"><CmsImage src={s.coverImage} alt={s.title} width={480} height={360} sizes="(max-width: 768px) 90vw, 30vw" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" /></div>}
            <h2 className="mt-4 font-display text-2xl leading-tight group-hover:text-gold">{s.title}</h2>
            {s.excerpt && <p className="mt-2 line-clamp-3 text-sm text-ink-2">{s.excerpt}</p>}
            {s.authorName && <p className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">Told by {s.authorName}</p>}
          </Link>
        ))}
      </div>
      {stories.length === 0 && <p className="mt-12 text-ink-3">No stories yet. Add the first one in the CMS under Stories.</p>}
    </div>
  );
}
