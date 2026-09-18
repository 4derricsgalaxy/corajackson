import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RichText } from "@/components/ui/RichText";
import { CmsImage } from "@/components/ui/CmsImage";
import { PersonCard } from "@/components/family/PersonCard";
import { PhotoGrid } from "@/components/family/PhotoGrid";
import { ancestorsOf, descendantCount, getFamilyGraph, getPhotos, getStories, siblingsOf } from "@/lib/content/queries";
import { lineColor } from "@/lib/tree-layout";
import { FamilyTreeExplorer } from "@/components/tree/FamilyTreeExplorer";
import { buildScene } from "@/lib/scene";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const graph = await getFamilyGraph();
  return graph.all.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const graph = await getFamilyGraph();
  const m = graph.bySlug.get(slug);
  if (!m) return {};
  return { title: m.title, description: m.shortBio ?? `${m.title}, part of the Cora Mae Jackson family.` };
}

const GEN_LABEL = ["Matriarch", "Child of Cora", "Grandchild of Cora", "Great-grandchild of Cora", "Great-great-grandchild of Cora"];

export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [graph, photos, stories] = await Promise.all([getFamilyGraph(), getPhotos(), getStories()]);
  const person = graph.bySlug.get(slug);
  if (!person) notFound();

  const ancestors = ancestorsOf(person, graph);
  const { prev, next } = siblingsOf(person, graph);
  const lineIndex = graph.lines.findIndex((l) => l.slug === person.lineSlug);
  const color = person.depth === 0 ? "#c39a4a" : lineColor(lineIndex, graph.lines[lineIndex]?.accentColor);
  const lineHead = person.lineSlug ? graph.bySlug.get(person.lineSlug) : undefined;

  const idSet = new Set([person._id]);
  const personPhotos = photos.filter((p) => p.peopleIds?.some((id) => idSet.has(id)) || (person.depth <= 1 && p.lineageId === person._id));
  const galleryImages = [...(person.gallery ?? []).map((img, i) => ({ _id: `g${i}`, image: img, title: person.title, caption: "" })), ...personPhotos];
  const personStories = stories.filter((s) => s.authorId === person._id || s.peopleIds?.includes(person._id));
  const descendants = descendantCount(person);

  // sub-tree scene: this person's line only (or whole tree for Cora)
  const scene = buildScene(graph);
  const lineSlug = person.lineSlug ?? (person.depth === 0 ? undefined : person.slug);
  const subNodes = person.depth === 0 ? scene.nodes : scene.nodes.filter((n) => n.generation === 0 || n.lineSlug === lineSlug);

  return (
    <article>
      {/* hero */}
      <header className="relative mx-auto max-w-7xl px-5 pt-6 md:px-8">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/family", label: "Family" }, ...ancestors.map((a) => ({ href: `/family/${a.slug}`, label: a.depth === 0 ? a.title.split(" ")[0] : a.nickname ?? a.title.split(" ")[0] })), { label: person.nickname ?? person.title.split(" ")[0] }]} />
        <div className="mt-8 grid gap-10 md:grid-cols-12 md:items-end">
          <div className="md:col-span-4 lg:col-span-4">
            <div className="frame rise rise-1 mx-auto max-w-sm rotate-[-1.5deg]">
              <CmsImage src={person.portrait} alt={person.title} width={560} height={720} priority sizes="(max-width: 768px) 80vw, 30vw" className="h-full w-full object-cover" />
              <span className="absolute -left-1 top-6 h-24 w-1.5" style={{ background: color }} />
            </div>
          </div>
          <div className="md:col-span-8">
            <p className="eyebrow rise rise-1" style={{ color }}>{GEN_LABEL[person.depth] ?? "Family"}{lineHead && person.depth > 1 ? ` · ${lineHead.nickname ?? lineHead.title.split(" ")[0]}'s line` : ""}</p>
            <h1 className="rise rise-2 mt-3 font-display text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.95]">{person.title}</h1>
            {person.nickname && person.nickname !== person.title && <p className="rise rise-2 mt-2 font-display text-2xl italic text-ink-3">“{person.nickname}”</p>}
            <dl className="rise rise-3 mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-line pt-6 sm:grid-cols-4">
              {person.birthDate && <Fact label="Born" value={formatDate(person.birthDate)} />}
              {person.deathDate && <Fact label="Passed" value={formatDate(person.deathDate)} />}
              {person.birthplace && <Fact label="Birthplace" value={person.birthplace} />}
              {person.residence && <Fact label="Home" value={person.residence} />}
              {person.spouse && <Fact label="Spouse" value={person.spouse} />}
              {person.parentNote && <Fact label="Family note" value={person.parentNote} />}
              {person.occupation && <Fact label="Work / Service" value={person.occupation} />}
              {person.children.length > 0 && <Fact label="Children" value={String(person.children.length)} />}
              {descendants > person.children.length && <Fact label="Descendants" value={String(descendants)} />}
            </dl>
          </div>
        </div>
      </header>

      {/* body */}
      <div className="mx-auto mt-16 grid max-w-7xl gap-14 px-5 md:grid-cols-12 md:px-8">
        <div className="md:col-span-7">
          {person.bio ? <RichText content={person.bio} /> : person.shortBio ? <p className="prose-heirloom">{person.shortBio}</p> : (
            <p className="rounded-md border border-dashed border-line p-6 text-sm text-ink-3">No biography has been written for {person.title} yet. Family members can add one in the CMS under Family Members → {person.title} → Biography.</p>
          )}

          {personStories.length > 0 && (
            <section className="mt-16">
              <p className="eyebrow mb-4">Stories</p>
              <ul className="divide-y divide-line border-y border-line">
                {personStories.map((s) => (
                  <li key={s._id}><Link href={`/stories/${s.slug}`} className="group block py-4"><p className="font-display text-xl group-hover:text-gold">{s.title}</p>{s.excerpt && <p className="mt-1 text-sm text-ink-3">{s.excerpt}</p>}</Link></li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="md:col-span-5">
          {ancestors.length > 0 && (
            <div className="rounded-lg border border-line p-5">
              <p className="eyebrow mb-3">Lineage</p>
              <ol className="space-y-2">
                {[...ancestors, person].map((a, i) => (
                  <li key={a._id} className="flex items-center gap-3" style={{ paddingLeft: i * 14 }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: i === ancestors.length ? color : "var(--ink-3)" }} />
                    {i === ancestors.length ? <span>{a.title}</span> : <Link href={`/family/${a.slug}`} className="link-underline text-ink-2">{a.title}</Link>}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="mt-4 flex items-stretch gap-2">
            {prev ? <Link href={`/family/${prev.slug}`} className="flex-1 rounded-lg border border-line p-4 text-sm transition hover:border-gold"><span className="eyebrow block">← Sibling</span><span className="mt-1 block">{prev.title}</span></Link> : <span className="flex-1" />}
            {next ? <Link href={`/family/${next.slug}`} className="flex-1 rounded-lg border border-line p-4 text-right text-sm transition hover:border-gold"><span className="eyebrow block">Sibling →</span><span className="mt-1 block">{next.title}</span></Link> : <span className="flex-1" />}
          </div>
          <Link href={`/family-tree`} className="mt-4 flex items-center justify-between rounded-lg bg-ink px-5 py-4 text-paper transition hover:bg-oak">
            <span>See {person.nickname ?? person.title.split(" ")[0]} on the living tree</span><span>→</span>
          </Link>
        </aside>
      </div>

      {/* children */}
      {person.children.length > 0 && (
        <section className="mx-auto mt-24 max-w-7xl px-5 md:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="eyebrow">{person.depth === 0 ? "Her children" : "Children"}</p>
              <h2 className="mt-2 font-display text-4xl">{person.children.length === 1 ? "One child" : `${person.children.length} children`}{descendants > person.children.length ? `, ${descendants} descendants` : ""}</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {person.children.map((c, i) => <PersonCard key={c._id} person={c} color={person.depth === 0 ? lineColor(i, c.accentColor) : undefined} index={i} />)}
          </div>
        </section>
      )}

      {/* line explorer */}
      {subNodes.length > 2 && (
        <section className="mx-auto mt-24 max-w-[1500px] px-4 md:px-6">
          <p className="eyebrow mb-2 px-1">{person.depth === 0 ? "The whole tree" : `${lineHead?.nickname ?? lineHead?.title.split(" ")[0] ?? person.title}'s branch`}</p>
          <FamilyTreeExplorer nodes={subNodes} lines={scene.lines.filter((l) => person.depth === 0 || l.slug === lineSlug)} initialSelected={person._id} />
        </section>
      )}

      {/* photos */}
      {galleryImages.length > 0 && (
        <section className="mx-auto mt-24 max-w-7xl px-5 md:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div><p className="eyebrow">Photographs</p><h2 className="mt-2 font-display text-4xl">{galleryImages.length} {galleryImages.length === 1 ? "photo" : "photos"}</h2></div>
            {lineHead && <Link href={`/gallery/${lineHead.slug}`} className="link-underline text-sm text-ink-2">Full album →</Link>}
          </div>
          <PhotoGrid photos={galleryImages} pageSize={12} />
        </section>
      )}
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (<div><dt className="eyebrow">{label}</dt><dd className="mt-1 text-lg">{value}</dd></div>);
}

function formatDate(iso: string) {
  if (/^\d{4}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
