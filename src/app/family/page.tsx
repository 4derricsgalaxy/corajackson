import type { Metadata } from "next";
import Link from "next/link";
import { PersonCard } from "@/components/family/PersonCard";
import { CmsImage } from "@/components/ui/CmsImage";
import { descendantCount, getFamilyGraph } from "@/lib/content/queries";
import { lineColor } from "@/lib/tree-layout";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Family Lines", description: "The eight children of Cora Mae Jackson and their descendants." };

export default async function FamilyIndexPage() {
  const graph = await getFamilyGraph();
  const cora = graph.root;
  return (
    <div className="mx-auto max-w-7xl px-5 pb-20 pt-8 md:px-8">
      <p className="eyebrow">Meet the family</p>
      <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[1] md:text-6xl">Eight children, each the start of a <em className="text-gold">line.</em></h1>

      {cora && (
        <Link href={`/family/${cora.slug}`} className="mt-12 grid items-center gap-6 rounded-xl border border-line bg-paper-2/60 p-5 transition hover:border-gold md:grid-cols-[160px_1fr_auto]">
          <div className="frame w-32">
            <CmsImage src={cora.portrait} alt={cora.title} width={128} height={160} className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="eyebrow">Where it begins</p>
            <p className="mt-1 font-display text-3xl">{cora.title}</p>
            {cora.shortBio && <p className="mt-2 max-w-xl text-ink-2">{cora.shortBio}</p>}
          </div>
          <span className="text-oak link-underline">Her page →</span>
        </Link>
      )}

      <div className="mt-16 space-y-20">
        {graph.lines.map((line, i) => {
          const color = lineColor(i, line.accentColor);
          return (
            <section key={line._id} id={line.slug} className="grid gap-8 md:grid-cols-[minmax(240px,320px)_1fr]">
              <div>
                <PersonCard person={line} color={color} index={0} />
                <Link href={`/family/${line.slug}`} className="mt-4 inline-flex items-center gap-2 text-sm text-oak link-underline">
                  Explore {line.nickname ?? line.title.split(" ")[0]}&apos;s line ({descendantCount(line)}) →
                </Link>
              </div>
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
                  <p className="eyebrow">{line.children.length ? `${line.children.length} children` : "Line"}</p>
                </div>
                <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-5">
                  {line.children.map((c, j) => <PersonCard key={c._id} person={c} size="sm" index={j} />)}
                  {line.children.length === 0 && <p className="col-span-full text-sm text-ink-3">No children recorded yet. Add them in the CMS under Family Members with {line.title} as parent.</p>}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
