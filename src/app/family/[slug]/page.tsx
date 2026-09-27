import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { clsx } from "clsx";
import { RichText } from "@/components/ui/RichText";
import { WixCanvas } from "@/components/wix/WixCanvas";
import { FooterLabel, PageNav } from "@/components/wix/WixNav";
import { PhotoSlider, type SliderPhoto } from "@/components/wix/PhotoSlider";
import { PersonChildren } from "@/components/wix/person/PersonChildren";
import { PersonFacts } from "@/components/wix/person/PersonFacts";
import { PersonPortrait } from "@/components/wix/person/PersonPortrait";
import { firstName } from "@/components/wix/person/parent-note";
import { PROJECT } from "@/lib/cms/client";
import { editableField, editablePage } from "@/lib/cms/sdk";
import { cropStyle } from "@/lib/content/crop";
import { fullSrc } from "@/lib/content/image";
import type { SiteImage } from "@/lib/content/types";
import { getAssetIndex, getFamilyGraph, getPhotos, getSettings, getStories } from "@/lib/content/queries";
import { quoteStyle } from "@/components/wix/person/quote-style";
import { pd } from "@/lib/design/keys";

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

/**
 * ONE template for every family member, modeled on the original Wix "Joanne Jackson" page:
 * name, portrait + fact pairs, italic quote, children grouped by their other parent,
 * the "Memories" photo slider, and the home / Family Tree nav. Everything comes from the CMS.
 */
export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [graph, photos, stories, settings, assets] = await Promise.all([getFamilyGraph(), getPhotos(), getStories(), getSettings(), getAssetIndex()]);
  const person = graph.bySlug.get(slug);
  if (!person) notFound();
  const editing = (await draftMode()).isEnabled;

  // Memories: the member's own gallery, photos tagged with them, and (for Cora and her children) the photos in their
  // line's album that nobody is tagged in. A line photo tagged with someone else belongs on that person's page only.
  const tagged = photos.filter((p) => p.peopleIds?.includes(person._id) || (person.depth <= 1 && p.lineageId === person._id && !p.peopleIds?.length));
  const seen = new Set<string>();
  const memories: SliderPhoto[] = [];
  const add = (key: string, image: SiteImage, edit: SliderPhoto["edit"], caption?: string) => {
    if (!image?.url || seen.has(image.url)) return;
    seen.add(image.url);
    memories.push({ key, url: image.url, srcset: image.srcset, fullUrl: fullSrc(image), alt: image.alt || caption || person.title, caption, position: image.position, cropStyle: cropStyle(image, 1), crop: image.crop, edit });
  };
  // edit mode: a gallery picture opens this member's gallery list, a tagged photo opens its own Photos entry
  (person.gallery ?? []).forEach((img, i) => add(`g${i}`, img, { docId: person._id, field: "gallery" }, img.alt || undefined));
  tagged.forEach((p) => add(p._id, p.image, { docId: p._id, field: "" }, p.caption || p.title || undefined));

  const personStories = stories.filter((s) => s.authorId === person._id || s.peopleIds?.includes(person._id));

  // The floating tab in the gray surround links UP one level ("Home" for Cora and her children).
  const parent = person.parentId ? graph.byId.get(person.parentId) : undefined;
  const up = parent && parent.depth > 0 ? { href: `/family/${parent.slug}`, label: firstName(parent) } : { href: "/", label: "Home" };

  // "Father: Donnie Lopp (divorced)" beside the portrait comes from the block this person sits in on their parent's
  // page, so it is typed once there; the person's own `parentNote` is only the fallback.
  const homeBlock = parent?.families?.find((f) => f.name && f.children.some((c) => c.childId === person._id));
  const otherParent = parent && homeBlock?.name
    ? { docId: parent._id, field: "families", label: `${homeBlock.role ?? "Parent"}:`, value: homeBlock.status ? `${homeBlock.name} (${homeBlock.status})` : homeBlock.name }
    : undefined;

  const t = pd();
  const hasBio = Array.isArray(person.bio) ? person.bio.length > 0 : Boolean(person.bio);
  // One standard write-up column on every page: exactly as wide as the portrait above it.
  const quoteClass = "wix-person-quote";
  // "Background strength (%)" on the entry: 0-100, empty = the standard 45% used by every page.
  const strength = typeof person.heroStrength === "number" ? Math.min(100, Math.max(0, person.heroStrength)) / 100 : undefined;
  const artStyle: CSSProperties | undefined = strength === undefined ? undefined : ({ "--wix-art-opacity": String(strength) } as CSSProperties);

  // The editor's "Page content" list: this member first, then each child (their tiles live on the CHILD's entry).
  const pageDocuments = [
    { docId: person._id, title: `${person.title} (this page)` },
    ...person.children.map((c) => ({ docId: c._id, title: `Child: ${c.title}` })),
  ];

  return (
    <div className="wix-person-wrap" data-sbx-page={PROJECT} {...editablePage(pageDocuments)}>
      <Link href={up.href} className="wix-side-tab wix-person-side-tab" {...t("side-tab")}>{up.label}</Link>

      <WixCanvas path={`/family/${person.slug}`} minHeight={560} className="wix-person">
        <article className="wix-person-body">
          {/* page art: the member's hero image if the CMS has one, else the original autumn leaves */}
          {person.heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- CMS page art, straight from the media CDN
            <img
              src={person.heroImage.url}
              srcSet={person.heroImage.srcset}
              sizes="(max-width: 980px) 100vw, 980px"
              alt=""
              aria-hidden
              className="wix-canvas-art wix-person-art wix-person-art-hero"
              style={{ ...artStyle, ...(person.heroImage.position ? { objectPosition: person.heroImage.position } : undefined) }}
              {...editableField(person._id, "heroImage")}
              {...t("art")}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- static decorative artwork
            <img src="/wix/leaves.png" alt="" aria-hidden className="wix-canvas-art wix-person-art" style={artStyle} {...editableField(person._id, "heroImage")} {...t("art")} />
          )}
          <div className="wix-person-cols">
            <div className="wix-person-left">
              <h1 className="wix-h1 wix-person-title" {...editableField(person._id, "title")} {...t("name")}>{person.title}</h1>
              {/* portrait + facts float; the quote sits under the portrait and wraps around a tall fact column */}
              <div className="wix-person-bio" {...t("bio-block", quoteStyle(settings), "Portrait, facts and write-up")}>
                <div className="wix-person-portrait" {...editableField(person._id, "portrait")} {...t("portrait")}>
                  <PersonPortrait image={person.portrait} name={person.title} width={160} height={215} priority />
                </div>
                <PersonFacts person={person} otherParent={otherParent} />
                {hasBio ? (
                  <div className={quoteClass} {...editableField(person._id, "bio")} {...t("write-up")}>
                    <RichText content={person.bio} className="wix-quote" />
                  </div>
                ) : person.shortBio ? (
                  <div className={clsx(quoteClass, "wix-quote")} {...editableField(person._id, "shortBio")} {...t("write-up")}>
                    <p>{person.shortBio}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="wix-person-right" {...t("children")}>
              <PersonChildren person={person} byId={graph.byId} assets={assets} />
            </div>
          </div>

          {memories.length > 0 && (
            <section className="wix-person-memories" aria-labelledby="wix-person-memories-h" {...t("memories")}>
              <h2 id="wix-person-memories-h" className="wix-strong wix-person-memories-h" {...t("memories-heading")}>Memories:</h2>
              <PhotoSlider photos={memories} label={`Photos of ${person.title}`} piece={t("memories-strip")} />
            </section>
          )}
          {/* edit mode only: a page with no photos gets a box that opens this member's Extra Memories photos */}
          {memories.length === 0 && editing && (
            <section className="wix-person-memories" aria-label="Add photos">
              <h2 className="wix-strong wix-person-memories-h">Memories:</h2>
              <div className="wix-add-photos" {...editableField(person._id, "gallery")}>
                <span className="wix-add-photos-plus" aria-hidden>+</span>
                <strong>Add photos</strong>
                <span>No photos on this page yet. Click to upload pictures to {firstName(person)}&apos;s Memories.</span>
                <span className="wix-add-photos-note">Only editors see this box.</span>
              </div>
            </section>
          )}

          <div className="wix-person-navband">
            {personStories.length > 0 && (
              <section className="wix-person-stories" aria-labelledby="wix-person-stories-h" {...t("stories")}>
                <h2 id="wix-person-stories-h" className="wix-strong" {...t("stories-heading")}>Stories:</h2>
                <ul {...t("stories-list")}>
                  {personStories.map((s) => (
                    <li key={s._id}><Link href={`/stories/${s.slug}`} className="wix-text-link">{s.title}</Link></li>
                  ))}
                </ul>
              </section>
            )}
            <PageNav className="wix-person-nav" layout={t("nav")} />
          </div>
        </article>

        <div className="wix-person-footer" {...t("footer")}>
          <FooterLabel text={settings.footerText} />
        </div>
      </WixCanvas>
    </div>
  );
}
