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
import type { DropChoices } from "@/components/photos/DropChooser";
import { PhotoDrop } from "@/components/photos/PhotoDrop";
import { ChildrenStart } from "@/components/wix/person/ChildSlots";
import { ChildrenScroll } from "@/components/wix/person/ChildrenScroll";
import { PersonChildren } from "@/components/wix/person/PersonChildren";
import { PersonFacts } from "@/components/wix/person/PersonFacts";
import { PersonPortrait } from "@/components/wix/person/PersonPortrait";
import { firstName } from "@/components/wix/person/parent-note";
import { PROJECT } from "@/lib/cms/client";
import { childrenAddedOn } from "@/lib/cms/edit-log";
import { editorForPage } from "@/lib/cms/page-access";
import { editableField, editablePage, stegaClean } from "@/lib/cms/sdk";
import { cropStyle } from "@/lib/content/crop";
import { fullSrc } from "@/lib/content/image";
import type { SiteImage } from "@/lib/content/types";
import { getAssetIndex, getFamilyGraph, getPhotos, getSettings, getStories } from "@/lib/content/queries";
import { quoteStyle } from "@/components/wix/person/quote-style";
import { pd, pdWords } from "@/lib/design/keys";
import { getDesign } from "@/lib/design/server";

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
  const description = m.shortBio ?? `${m.title}, part of the Cora Mae Jackson family.`;
  const settings = await getSettings();
  const picture = m.portrait ?? m.treePhoto ?? settings.heroImage;
  return {
    title: m.title,
    description,
    openGraph: { type: "profile", siteName: settings.title, title: m.title.trim(), description, images: picture?.url ? [{ url: picture.url, alt: m.title.trim() }] : undefined },
  };
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
  const path = `/family/${person.slug}`;
  // edit mode, on a page this editor may change (their own, their children's; owners every page): the Children slots
  const editor = editing ? await editorForPage(path) : null;
  const slotted = Boolean(editor);
  // no children and no "Children on this page" list: the solo page (the slots' "Add children" button turns it standard)
  const solo = person.children.length === 0 && !person.families?.length;

  // Memories: the member's own gallery, photos tagged with them, and (for Cora and her children) the photos in their
  // line's album that nobody is tagged in. A line photo tagged with someone else belongs on that person's page only.
  const tagged = photos.filter((p) => p.peopleIds?.includes(person._id) || (person.depth <= 1 && p.lineageId === person._id && !p.peopleIds?.length));
  const seen = new Set<string>();
  const memories: SliderPhoto[] = [];
  const add = (key: string, image: SiteImage, edit: SliderPhoto["edit"], caption?: string, cropItem?: string) => {
    if (!image?.url || seen.has(image.url)) return;
    seen.add(image.url);
    memories.push({ key, url: image.url, srcset: image.srcset, fullUrl: fullSrc(image), alt: image.alt || caption || person.title, caption, position: image.position, cropStyle: cropStyle(image, 1), crop: image.crop, edit, cropItem });
  };
  // edit mode: a gallery picture opens this member's gallery list, a tagged photo opens its own Photos entry
  (person.gallery ?? []).forEach((img, i) => add(`g${i}`, img, { docId: person._id, field: "gallery" }, img.alt || undefined, `gallery:${i}`));
  tagged.forEach((p) => add(p._id, p.image, { docId: p._id, field: "" }, p.caption || p.title || undefined));

  // a dropped photo is asked about first: a memory, a child's photo or the other parent's (the list's blocks and children)
  const plain = (v?: string | null) => stegaClean(v ?? "") as string;
  const choices: DropChoices | undefined = slotted
    ? {
        path,
        first: plain(firstName(person)),
        blocks: (person.families ?? []).map((f) => ({ key: f.key, role: plain(f.role), name: plain(f.name), hasPhoto: Boolean(f.photo) })),
        kids: (person.families ?? []).flatMap((f) =>
          f.children.flatMap(({ childId, photo }) => {
            const kid = graph.byId.get(childId);
            return kid ? [{ id: childId, name: plain(kid.title), block: f.key, hasPhoto: Boolean(photo) }] : [];
          }),
        ),
      }
    : undefined;

  const personStories = stories.filter((s) => s.authorId === person._id || s.peopleIds?.includes(person._id));
  // a child the slots may take off the page again: one added here with the slots (Edit log), whose entry holds nothing of its own yet
  const addedHere = editor ? await childrenAddedOn(editor, path) : new Set<string>();
  const removable = new Set(
    slotted
      ? person.children
          .filter((c) => addedHere.has(c._id) && !c.children.length && !c.families?.length && !c.bio && !c.shortBio && !c.gallery?.length)
          .filter((c) => !photos.some((p) => p.peopleIds?.includes(c._id)) && !stories.some((s) => s.authorId === c._id || s.peopleIds?.includes(c._id)))
          .map((c) => c._id)
      : [],
  );

  // The floating tab in the gray surround links UP one level ("Home" for Cora and her children).
  const parent = person.parentId ? graph.byId.get(person.parentId) : undefined;
  const up = parent && parent.depth > 0 ? { href: `/family/${parent.slug}`, label: firstName(parent) } : { href: "/", label: "Home" };


  const t = pd();
  // captions (labels, headings, buttons, child names) can be re-worded per page with the Design tool
  const design = (await getDesign(path))?.items;
  const w = pdWords(design);
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
      <Link href={up.href} className="wix-side-tab wix-person-side-tab" {...w("side-tab", up.label, "Side tab")} />
      {/* edit mode: drop photos anywhere on the page (or press Add photos) to add them to this person's Memories */}
      {editing && <PhotoDrop target={{ kind: "person", id: person._id, name: person.title, first: firstName(person) }} choices={choices} />}
      {slotted && solo && <ChildrenStart path={path} first={firstName(person)} />}

      <WixCanvas path={path} minHeight={560} className="wix-person">
        {/* no children: the standard "solo" page modeled on Emrick's (big portrait toward the middle, no Children column) */}
        <article className={clsx("wix-person-body", solo && "wix-person-solo")}>
          {/* page art: the member's own Page background if the CMS has one, else none. In edit mode an empty page still
              gets an invisible full-page target, so clicking the background opens the Page background field to add one. */}
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
          ) : editing ? (
            <div aria-hidden className="wix-canvas-art wix-person-art wix-person-art-empty" {...editableField(person._id, "heroImage")} />
          ) : null}
          <div className="wix-person-cols">
            <div className="wix-person-left">
              <h1 className="wix-h1 wix-person-title" {...editableField(person._id, "title")} {...t("name")}>{person.title}</h1>
              {/* portrait + facts float; the quote sits under the portrait and wraps around a tall fact column */}
              <div className="wix-person-bio" {...t("bio-block", quoteStyle(settings), "Portrait, facts and write-up")}>
                <div className="wix-person-portrait" {...editableField(person._id, "portrait")} {...t("portrait")}>
                  <PersonPortrait image={person.portrait} name={person.title} width={solo ? 243 : 160} height={solo ? 327 : 215} priority />
                </div>
                <PersonFacts person={person} editing={editing} design={design} />
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
              <PersonChildren person={person} byId={graph.byId} assets={assets} design={design} slots={slotted ? { path, removable } : undefined} />
              <ChildrenScroll />
            </div>
          </div>

          {memories.length > 0 && (
            <section className="wix-person-memories" aria-labelledby="wix-person-memories-h" {...t("memories")}>
              <h2 id="wix-person-memories-h" className="wix-strong wix-person-memories-h" {...w("memories-heading", "Memories:")} />
              <PhotoSlider photos={memories} label={`Photos of ${person.title}`} piece={t("memories-strip")} />
            </section>
          )}
          <div className="wix-person-navband">
            {/* edit mode only: a page with no photos gets a box that opens this member's Extra Memories photos. It floats
                just above the nav and takes no room, so edit mode is laid out exactly like the page visitors see. */}
            {memories.length === 0 && editing && (
              <div className="wix-add-photos" {...editableField(person._id, "gallery")}>
                <strong>+ Add photos</strong>
                <span>No photos yet: drag photos onto this page, or press <b>Add photos</b> (bottom right). Only editors see this.</span>
              </div>
            )}
            {personStories.length > 0 && (
              <section className="wix-person-stories" aria-labelledby="wix-person-stories-h" {...t("stories")}>
                <h2 id="wix-person-stories-h" className="wix-strong" {...w("stories-heading", "Stories:")} />
                <ul {...t("stories-list")}>
                  {personStories.map((s) => (
                    <li key={s._id}><Link href={`/stories/${s.slug}`} className="wix-text-link">{s.title}</Link></li>
                  ))}
                </ul>
              </section>
            )}
            <PageNav className="wix-person-nav" layout={t("nav")} design={design ?? {}} />
          </div>
        </article>

        <div className="wix-person-footer" {...t("footer")}>
          <FooterLabel text={settings.footerText} design={design ?? {}} />
        </div>
      </WixCanvas>
    </div>
  );
}
