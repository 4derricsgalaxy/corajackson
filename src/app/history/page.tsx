import type { Metadata } from "next";
import Link from "next/link";
import { RichText } from "@/components/ui/RichText";
import { CmsImage } from "@/components/ui/CmsImage";
import { getFamilyGraph, getHistory } from "@/lib/content/queries";

export const revalidate = 3600;
export const metadata: Metadata = { title: "History", description: "The story of the Jackson family, from Brinkley, Arkansas onward." };

export default async function HistoryPage() {
  const [entries, graph] = await Promise.all([getHistory(), getFamilyGraph()]);
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-8 md:px-8">
      <p className="eyebrow">History</p>
      <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[1] md:text-6xl">From Brinkley, Arkansas, <em className="text-gold">outward.</em></h1>
      <p className="mt-5 max-w-xl text-lg text-ink-2">A timeline of the family, kept in the CMS. Each entry can carry a photo, a place, and the people it belongs to.</p>

      <ol className="relative mt-16 border-l border-line pl-8 md:pl-14">
        {entries.map((e, i) => {
          const people = (e.peopleIds ?? []).map((id) => graph.byId.get(id)).filter(Boolean);
          return (
            <li key={e._id} className="relative mb-16 last:mb-0">
              <span className="absolute -left-[2.05rem] top-2 grid h-4 w-4 place-items-center md:-left-[3.55rem]">
                <span className="h-2.5 w-2.5 rounded-full bg-gold ring-4 ring-paper" />
              </span>
              <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-3">{e.dateLabel ?? e.year ?? ""}{e.location ? ` · ${e.location}` : ""}</p>
                  <h2 className="mt-2 font-display text-3xl leading-tight">{e.title}</h2>
                  <RichText content={e.body} className="mt-4 text-base" />
                  {people.length > 0 && (
                    <p className="mt-4 flex flex-wrap gap-1.5 text-xs">
                      {people.map((p) => p && <Link key={p._id} href={`/family/${p.slug}`} className="rounded-full border border-line px-2.5 py-1 transition hover:border-gold">{p.title}</Link>)}
                    </p>
                  )}
                </div>
                {e.image && (
                  <div className={`frame self-start ${i % 2 ? "rotate-1" : "-rotate-1"}`}>
                    <CmsImage src={e.image} alt={e.title} width={280} height={340} sizes="280px" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {entries.length === 0 && <li className="text-ink-3">No history entries yet. Add them in the CMS under History Timeline.</li>}
      </ol>
    </div>
  );
}
