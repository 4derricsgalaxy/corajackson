import Link from "next/link";
import { CmsImage } from "@/components/ui/CmsImage";
import { RichText } from "@/components/ui/RichText";
import { PersonCard } from "@/components/family/PersonCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { descendantCount, getFamilyGraph, getPhotos, getSettings, getStories } from "@/lib/content/queries";
import { lineColor } from "@/lib/tree-layout";

export const revalidate = 3600;

export default async function HomePage() {
  const [settings, graph, stories, photos] = await Promise.all([getSettings(), getFamilyGraph(), getStories(), getPhotos()]);
  const cora = graph.root;
  const lines = graph.lines;
  const totalDescendants = cora ? descendantCount(cora) : 0;
  const grandchildren = lines.reduce((n, l) => n + l.children.length, 0);
  const greatGrandchildren = lines.reduce((n, l) => n + l.children.reduce((m, c) => m + c.children.length, 0), 0);
  const featuredPhotos = photos.filter((p) => p.featured).slice(0, 6);
  const heroPhotos = featuredPhotos.length ? featuredPhotos : photos.slice(0, 6);

  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-10 md:grid-cols-12 md:px-8 md:pt-16">
        <div className="md:col-span-7 md:pt-10">
          <p className="eyebrow rise rise-1">Brinkley, Arkansas · A family record</p>
          <h1 className="rise rise-2 mt-5 font-display text-[clamp(2.8rem,7vw,6rem)] leading-[0.95]">
            {settings.heroHeading ?? (
              <>
                The family of <em className="text-gold">Cora Mae</em> Jackson
              </>
            )}
          </h1>
          <div className="rise rise-3 mt-8 max-w-xl">
            <RichText content={settings.heroIntro} />
          </div>
          <div className="rise rise-4 mt-10 flex flex-wrap items-center gap-4">
            <Link href="/family-tree" className="group inline-flex items-center gap-3 rounded-full bg-ink px-6 py-3 text-paper transition hover:bg-oak">
              Explore the living tree
              <span className="grid h-6 w-6 place-items-center rounded-full bg-paper/15 transition group-hover:translate-x-1">→</span>
            </Link>
            <Link href="/family" className="link-underline text-ink-2">Meet the family</Link>
          </div>
          <dl className="rise rise-4 mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-line pt-6">
            <Stat n={lines.length} label="children" />
            <Stat n={grandchildren} label="grandchildren" />
            <Stat n={greatGrandchildren} label="great-grandchildren" />
          </dl>
        </div>
        <div className="relative md:col-span-5">
          <div className="frame rise rise-2 mx-auto w-[78%] rotate-[-2deg] md:w-[88%]">
            <CmsImage src={settings.heroImage ?? cora?.portrait} alt={cora?.title ?? "Cora Mae Jackson"} width={640} height={860} priority sizes="(max-width: 768px) 78vw, 36vw" className="h-full w-full object-cover" />
          </div>
          {cora && (
            <Link href={`/family/${cora.slug}`} className="rise rise-4 absolute -bottom-6 left-0 max-w-[16rem] rotate-[2deg] bg-paper-2 p-4 shadow-[var(--shadow)] md:-left-6">
              <p className="eyebrow">Matriarch</p>
              <p className="mt-1 font-display text-xl leading-tight">{cora.title}</p>
              {cora.shortBio && <p className="mt-1 line-clamp-2 text-xs text-ink-3">{cora.shortBio}</p>}
              <span className="mt-2 inline-block text-xs text-oak link-underline">Read her story →</span>
            </Link>
          )}
          {settings.treeImage && (
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-14 hidden w-64 opacity-[0.16] mix-blend-multiply md:block dark:mix-blend-screen">
              <CmsImage src={settings.treeImage} alt="" width={256} height={292} fit="fit" className="h-auto w-full" />
            </div>
          )}
        </div>
      </section>

      {/* ---------- THE EIGHT LINES ---------- */}
      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8">
        <SectionHeading
          eyebrow="The family lines"
          title={<>Eight children. <em className="text-gold">{totalDescendants}</em> descendants and counting.</>}
          intro="Each of Ms. Cora's children begins a line of their own. Choose one to walk down through the generations."
          action={<Link href="/family" className="link-underline text-ink-2">All lines →</Link>}
        />
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
          {lines.map((l, i) => (
            <PersonCard key={l._id} person={l} color={lineColor(i, l.accentColor)} index={i} />
          ))}
        </div>
      </section>

      {/* ---------- TREE TEASER ---------- */}
      <section className="relative mx-auto max-w-7xl overflow-hidden rounded-xl border border-line bg-gradient-to-br from-oak/10 via-paper-2 to-gold/10 px-6 py-16 md:mx-8 md:px-14 md:py-24">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="eyebrow mb-4">Interactive</p>
            <h2 className="font-display text-4xl leading-[1.05] md:text-5xl">A tree you can <em className="text-gold">walk through.</em></h2>
            <p className="mt-5 text-lg text-ink-2">Ms. Cora is the trunk. Her children are the great branches. Every grandchild and great-grandchild is a leaf you can touch. Orbit it, follow one line at a time, and open anyone&apos;s page.</p>
            <Link href="/family-tree" className="mt-8 inline-flex items-center gap-2 rounded-full border border-ink px-5 py-2.5 transition hover:bg-ink hover:text-paper">Open the tree →</Link>
          </div>
          <TreeGlyph lines={lines.map((l, i) => lineColor(i, l.accentColor))} />
        </div>
      </section>

      {/* ---------- PHOTOS + STORIES ---------- */}
      <section className="mx-auto grid max-w-7xl gap-14 px-5 py-24 md:grid-cols-[1.3fr_1fr] md:px-8">
        <div>
          <SectionHeading eyebrow="From the albums" title="Moments the family kept." action={<Link href="/gallery" className="link-underline text-ink-2">Gallery →</Link>} />
          <div className="grid grid-cols-3 gap-3">
            {heroPhotos.map((p, i) => (
              <Link key={p._id} href="/gallery" className={i === 0 ? "col-span-2 row-span-2" : ""}>
                <div className="frame h-full overflow-hidden">
                  <CmsImage src={p.image} alt={p.title || p.caption || "Family photo"} width={i === 0 ? 640 : 300} height={i === 0 ? 640 : 300} sizes="(max-width: 768px) 33vw, 20vw" className="h-full w-full object-cover transition duration-700 hover:scale-105" />
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <SectionHeading eyebrow="Stories" title="Told by the family." action={<Link href="/stories" className="link-underline text-ink-2">All stories →</Link>} />
          <ul className="divide-y divide-line border-y border-line">
            {stories.slice(0, 4).map((s) => (
              <li key={s._id}>
                <Link href={`/stories/${s.slug}`} className="group block py-5">
                  <p className="font-display text-xl leading-snug transition group-hover:text-gold">{s.title}</p>
                  {s.excerpt && <p className="mt-1 line-clamp-2 text-sm text-ink-3">{s.excerpt}</p>}
                  {s.authorName && <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">Told by {s.authorName}</p>}
                </Link>
              </li>
            ))}
            {stories.length === 0 && <li className="py-5 text-sm text-ink-3">Stories can be added any time in the CMS.</li>}
          </ul>
        </div>
      </section>
    </>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-display text-4xl">{n}</dd>
    </div>
  );
}

function TreeGlyph({ lines }: { lines: string[] }) {
  const n = Math.max(lines.length, 1);
  return (
    <svg viewBox="0 0 400 320" className="mx-auto w-full max-w-md" aria-hidden>
      <path d="M200 310 C 196 260, 204 230, 200 190" stroke="var(--bark)" strokeWidth="14" fill="none" strokeLinecap="round" />
      {lines.map((c, i) => {
        const a = Math.PI + (i + 0.5) * (Math.PI / n);
        const x = 200 + Math.cos(a) * 150;
        const y = 190 + Math.sin(a) * 120;
        return (
          <g key={i}>
            <path d={`M200 190 Q ${200 + (x - 200) * 0.4} ${190 + (y - 190) * 0.9} ${x} ${y}`} stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.9" />
            <circle cx={x} cy={y} r="14" fill={c} />
            {[0, 1, 2].map((k) => (
              <circle key={k} cx={x + Math.cos(a + (k - 1) * 0.5) * 34} cy={y + Math.sin(a + (k - 1) * 0.5) * 34} r="5" fill={c} opacity="0.7" />
            ))}
          </g>
        );
      })}
      <circle cx="200" cy="190" r="22" fill="var(--gold)" />
    </svg>
  );
}
