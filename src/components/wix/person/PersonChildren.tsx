import Link from "next/link";
import { CmsImage } from "@/components/ui/CmsImage";
import { editableField } from "@/lib/cms/sdk";
import { resolveImage } from "@/lib/content/image";
import type { SiteImage, TreeNode } from "@/lib/content/types";
import { PersonPortrait } from "./PersonPortrait";
import { firstName, groupByParentNote, nameKey, parseParentNote, titleCase, type ParsedParentNote } from "./parent-note";

interface Tile {
  child: TreeNode;
  image?: SiteImage;
  /** the CMS field a click on the photo opens in edit mode */
  edit: { docId: string; field: string };
}

interface Block {
  key: string;
  note?: ParsedParentNote;
  partnerPhoto?: SiteImage;
  /** the list on this member that holds the partner photo */
  partnerField: "families" | "partners";
  tiles: Tile[];
}

interface Props {
  person: TreeNode;
  /** every published member, to turn the list's child references into people */
  byId: Map<string, TreeNode>;
  /** resolved images by asset id - finishes the photos stored inside the list */
  assets: Map<string, SiteImage>;
}

/**
 * "Children" heading + one block per spouse / other parent, as on the original pages: the note
 * lines, that person's small photo in the left gutter, then the row of child portraits.
 *
 * The member's own "Children on this page" list (`families`) decides the blocks, their order and the
 * photo each child gets HERE. A child whose Parent is this member but who is not listed still shows:
 * in the block naming the same other parent, else in a block built from the child's `parentNote`.
 */
export function PersonChildren({ person, byId, assets }: Props) {
  // the original showed a childhood photo here, not the portrait from the child's own page
  const ownPhoto = (child: TreeNode): Tile => ({
    child,
    image: child.treePhoto?.url ? child.treePhoto : child.portrait,
    edit: { docId: child._id, field: child.treePhoto?.url ? "treePhoto" : "portrait" },
  });

  const listed = new Set<string>();
  const blocks: Block[] = (person.families ?? []).map((family) => {
    const tiles = family.children.flatMap(({ childId, photo }): Tile[] => {
      const child = byId.get(childId);
      if (!child || listed.has(childId)) return [];
      listed.add(childId);
      const custom = resolveImage(photo, assets);
      return [custom ? { child, image: custom, edit: { docId: person._id, field: "families" } } : ownPhoto(child)];
    });
    const note = family.name
      ? { role: family.role ?? (tiles.length ? "Parent" : "Partner"), name: family.name, status: family.status ? titleCase(family.status) : undefined }
      : undefined;
    return { key: family.key, note, partnerPhoto: resolveImage(family.photo, assets), partnerField: "families", tiles };
  });

  // children not in the list: join the block of the same other parent, else get one from their own note
  const legacyPartners = person.partners ?? [];
  for (const group of groupByParentNote(person.children.filter((c) => !listed.has(c._id)))) {
    const name = group.note ? nameKey(group.note.name) : undefined;
    const home = name ? blocks.find((b) => b.note && nameKey(b.note.name) === name) : undefined;
    if (home) {
      home.tiles.push(...group.members.map(ownPhoto));
      if (home.note && !home.note.status) home.note.status = group.note?.status;
      continue;
    }
    const partner = name ? legacyPartners.find((p) => nameKey(p.name) === name) : undefined;
    blocks.push({ key: group.key, note: group.note, partnerPhoto: partner?.photo, partnerField: "partners", tiles: group.members.map(ownPhoto) });
  }

  // before a member has a list: the old `partners` field still orders the blocks and adds childless partners
  if (!person.families?.length && legacyPartners.length) {
    const spouse = person.spouse ? parseParentNote(`Spouse: ${person.spouse}`) : undefined;
    for (const partner of legacyPartners) {
      if (blocks.some((b) => b.note && nameKey(b.note.name) === nameKey(partner.name))) continue;
      const isSpouse = spouse && nameKey(spouse.name) === nameKey(partner.name);
      blocks.push({ key: `partner:${partner.name}`, note: isSpouse ? spouse : { role: "Partner", name: partner.name }, partnerPhoto: partner.photo, partnerField: "partners", tiles: [] });
    }
    const rank = (b: Block) => {
      const i = b.note ? legacyPartners.findIndex((p) => nameKey(p.name) === nameKey(b.note!.name)) : -1;
      return i < 0 ? legacyPartners.length : i;
    };
    blocks.sort((a, b) => rank(a) - rank(b));
  }

  const shown = blocks.filter((b) => b.tiles.length > 0 || b.note);
  if (!shown.length) return null;

  return (
    <section className="wix-person-children" aria-labelledby="wix-person-children-h">
      <h2 id="wix-person-children-h" className="wix-h2 wix-person-children-h">Children</h2>
      {shown.map((block) => (
        <div key={block.key} className="wix-person-group">
          {block.note && (
            <p className="wix-note wix-person-group-note" {...(block.partnerField === "families" ? editableField(person._id, "families") : {})}>
              <span className="wix-person-note-line"><b>{block.note.role}:</b> {block.note.name}</span>
              {block.note.status && (
                <span className="wix-person-note-line"><b>Marital Status:</b> {block.note.status}</span>
              )}
            </p>
          )}
          <div className="wix-person-group-body">
            {block.partnerPhoto?.url && (
              <span className="wix-person-partner" {...editableField(person._id, block.partnerField)}>
                <CmsImage src={block.partnerPhoto} alt={block.partnerPhoto.alt || block.note?.name || ""} width={148} height={168} sizes="74px" />
              </span>
            )}
            {block.tiles.length > 0 ? (
              <ul className="wix-person-kids">
                {block.tiles.map(({ child, image, edit }) => (
                  <li key={child._id}>
                    <Link href={`/family/${child.slug}`} className="wix-person-kid">
                      {/* in edit mode the photo opens wherever it comes from: this member's list, or the child's own entry */}
                      <span className="wix-person-kid-photo" {...editableField(edit.docId, edit.field)}>
                        <PersonPortrait image={image} name={child.title} width={99} height={121} />
                      </span>
                      <span className="wix-child-name wix-person-kid-name" {...editableField(child._id, child.nickname ? "nickname" : "title")}>{firstName(child)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="wix-person-nokids">No Children</p>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
