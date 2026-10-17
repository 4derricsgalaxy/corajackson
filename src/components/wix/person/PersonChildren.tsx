import Link from "next/link";
import { CmsImage } from "@/components/ui/CmsImage";
import { editableField, stegaClean } from "@/lib/cms/sdk";
import { resolveImage } from "@/lib/content/image";
import { keyPart, pd, pdWords } from "@/lib/design/keys";
import type { Look } from "@/lib/design/model";
import type { Family, SiteImage, TreeNode } from "@/lib/content/types";
import { KidSlot, KidTools, NewBlock, ParentEdit, PartnerSlot } from "./ChildSlots";
import { PersonPortrait } from "./PersonPortrait";
import { firstName, groupByParentNote, nameKey, parseParentNote, titleCase, type ParsedParentNote } from "./parent-note";

interface Tile {
  child: TreeNode;
  image?: SiteImage;
  /** the CMS field a click on the photo opens in edit mode */
  edit: { docId: string; field: string };
  /** in this member's "Children on this page" list (the slots can change it); `pagePhoto`: has its own photo there */
  listed?: boolean;
  pagePhoto?: boolean;
}

interface Block {
  key: string;
  note?: ParsedParentNote;
  partnerPhoto?: SiteImage;
  /** the list on this member that holds the partner photo */
  partnerField: "families" | "partners";
  /** the list block behind it, when it is one */
  family?: Family;
  tiles: Tile[];
}

interface Props {
  person: TreeNode;
  /** every published member, to turn the list's child references into people */
  byId: Map<string, TreeNode>;
  /** resolved images by asset id - finishes the photos stored inside the list */
  assets: Map<string, SiteImage>;
  /** this page's Design-tool changes (re-worded captions) */
  design?: Record<string, Look>;
  /** edit mode, on a page the editor may change: the plug-and-play slots (see ChildSlots) */
  slots?: { path: string; removable: Set<string> };
}

/**
 * "Children" heading + one block per spouse / other parent, as on the original pages: the note
 * lines, that person's small photo in the left gutter, then the row of child portraits.
 *
 * The member's own "Children on this page" list (`families`) decides the blocks, their order and the
 * photo each child gets HERE. A child whose Parent is this member but who is not listed still shows:
 * in the block naming the same other parent, else in a block built from the child's `parentNote`.
 */
export function PersonChildren({ person, byId, assets, design, slots }: Props) {
  const t = pd();
  const w = pdWords(design);
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
      return [{ ...(custom ? { child, image: custom, edit: { docId: person._id, field: "families" } } : ownPhoto(child)), listed: true, pagePhoto: Boolean(custom) }];
    });
    const note = family.name
      ? { role: family.role ?? (tiles.length ? "Parent" : "Partner"), name: family.name, status: family.status ? titleCase(family.status) : undefined }
      : undefined;
    return { key: family.key, note, partnerPhoto: resolveImage(family.photo, assets), partnerField: "families", family, tiles };
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

  // with the slots every list block shows (even an empty one), so it can be filled in
  const shown = blocks.filter((b) => b.tiles.length > 0 || b.note || (slots && b.family));
  if (!shown.length) return null;

  const plain = (v?: string | null) => stegaClean(v ?? "") as string;

  return (
    <section className="wix-person-children" aria-labelledby="wix-person-children-h">
      <h2 id="wix-person-children-h" className="wix-h2 wix-person-children-h" {...w("children-heading", "Children")} />
      {shown.map((block) => {
        // the slots work on list blocks only (a child shown by the safety net keeps the usual edit bindings)
        const slot = slots && block.family ? { path: slots.path, key: block.family.key } : undefined;
        return (
          <div key={block.key} className="wix-person-group" {...t(`group-${keyPart(block.key)}`, undefined, `Children group${block.note ? `: ${block.note.name}` : ""}`)}>
            {block.note && (
              <p className="wix-note wix-person-group-note" {...(block.partnerField === "families" ? editableField(person._id, "families") : {})} {...t(`note-${keyPart(block.key)}`, undefined, `Note: ${block.note.name}`)}>
                <span className="wix-person-note-line"><b {...w(`role-${keyPart(block.key)}`, `${block.note.role}:`, `Label: ${block.note.role}`)} /> {block.note.name}</span>
                {block.note.status && (
                  <span className="wix-person-note-line"><b {...w(`statuslabel-${keyPart(block.key)}`, "Marital Status:", "Label: Marital Status")} /> {block.note.status}</span>
                )}
              </p>
            )}
            {slot && (
              <ParentEdit
                path={slot.path}
                block={slot.key}
                role={plain(block.family!.role)}
                name={plain(block.family!.name)}
                status={plain(block.family!.status)}
                empty={!block.note}
                canRemove={block.tiles.length === 0}
              />
            )}
            <div className="wix-person-group-body">
              {block.partnerPhoto?.url && (
                <span className="wix-person-partner" data-drop-parent={slot?.key} {...editableField(person._id, block.partnerField)} {...t(`partner-${keyPart(block.key)}`, undefined, `Photo: ${block.note?.name ?? "partner"}`)}>
                  <CmsImage src={block.partnerPhoto} alt={block.partnerPhoto.alt || block.note?.name || ""} width={148} height={168} sizes="74px" />
                </span>
              )}
              {slot && <PartnerSlot path={slot.path} block={slot.key} filled={Boolean(block.partnerPhoto?.url)} />}
              {block.tiles.length > 0 || slot ? (
                <ul className="wix-person-kids">
                  {block.tiles.map(({ child, image, edit, listed, pagePhoto }) => (
                    <li key={child._id} data-drop-kid={slot && listed ? child._id : undefined} {...t(`kidtile-${keyPart(child._id)}`, undefined, `Child: ${firstName(child)}`)}>
                      <Link href={`/family/${child.slug}`} className="wix-person-kid">
                        {/* in edit mode the photo opens wherever it comes from: this member's list, or the child's own entry */}
                        <span className="wix-person-kid-photo" {...editableField(edit.docId, edit.field)} {...t(`kidphoto-${keyPart(child._id)}`, undefined, `Child photo: ${firstName(child)}`)}>
                          <PersonPortrait image={image} name={child.title} width={99} height={121} />
                        </span>
                        <span className="wix-child-name wix-person-kid-name" {...editableField(child._id, child.nickname ? "nickname" : "title")} {...w(`kid-${keyPart(child._id)}`, firstName(child), `Child name: ${firstName(child)}`)} />
                      </Link>
                      {slot && listed && (
                        <KidTools path={slot.path} child={child._id} name={plain(child.title)} hasPagePhoto={Boolean(pagePhoto)} removable={slots!.removable.has(child._id)} />
                      )}
                    </li>
                  ))}
                  {/* the next empty slot: only ever one, and only in edit mode */}
                  {slot && <KidSlot key={`slot-${block.tiles.length}`} path={slot.path} block={slot.key} first={block.tiles.length === 0} />}
                </ul>
              ) : (
                <p className="wix-person-nokids" {...w(`nokids-${keyPart(block.key)}`, "No Children", "No Children")} />
              )}
            </div>
          </div>
        );
      })}
      {slots && <NewBlock path={slots.path} />}
    </section>
  );
}
