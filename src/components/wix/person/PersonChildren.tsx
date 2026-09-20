import Link from "next/link";
import { CmsImage } from "@/components/ui/CmsImage";
import { editableField } from "@/lib/cms/sdk";
import type { Partner, TreeNode } from "@/lib/content/types";
import { PersonPortrait } from "./PersonPortrait";
import { firstName, groupByParentNote, nameKey, parseParentNote, type ParsedParentNote } from "./parent-note";

interface Block {
  key: string;
  note?: ParsedParentNote;
  partner?: Partner;
  members: TreeNode[];
}

/**
 * "Children" heading + one block per spouse / other parent, as on the original pages: the note
 * lines, that person's small photo in the left gutter, then the row of child portraits.
 * A partner listed on the member with no children here still gets a block ("No Children").
 */
export function PersonChildren({ person }: { person: TreeNode }) {
  const partners = person.partners ?? [];
  const byName = new Map(partners.map((p) => [nameKey(p.name), p]));
  const blocks: Block[] = groupByParentNote(person.children).map((g) => ({
    ...g,
    partner: g.note ? byName.get(nameKey(g.note.name)) : undefined,
  }));
  const shown = new Set(blocks.map((b) => b.partner).filter(Boolean));
  // the `spouse` text ("Janessa Webb (divorced)") supplies the status line for a childless partner
  const spouse = person.spouse ? parseParentNote(`Spouse: ${person.spouse}`) : undefined;
  for (const partner of partners) {
    if (shown.has(partner)) continue;
    const isSpouse = spouse && nameKey(spouse.name) === nameKey(partner.name);
    blocks.push({ key: `partner:${partner.name}`, note: isSpouse ? spouse : { role: "Partner", name: partner.name }, partner, members: [] });
  }
  // blocks follow the order of the member's partner list (as the original pages did); unlisted ones keep their place after
  const rank = (b: Block) => (b.partner ? partners.indexOf(b.partner) : partners.length);
  blocks.sort((a, b) => rank(a) - rank(b));
  if (!blocks.length) return null;

  return (
    <section className="wix-person-children" aria-labelledby="wix-person-children-h">
      <h2 id="wix-person-children-h" className="wix-h2 wix-person-children-h">Children</h2>
      {blocks.map((block) => (
        <div key={block.key} className="wix-person-group">
          {block.note && (
            <p className="wix-note wix-person-group-note">
              <span className="wix-person-note-line"><b>{block.note.role}:</b> {block.note.name}</span>
              {block.note.status && (
                <span className="wix-person-note-line"><b>Marital Status:</b> {block.note.status}</span>
              )}
            </p>
          )}
          <div className="wix-person-group-body">
            {block.partner?.photo?.url && (
              <span className="wix-person-partner" {...editableField(person._id, "partners")}>
                <CmsImage src={block.partner.photo} alt={block.partner.photo.alt || block.partner.name} width={148} height={168} sizes="74px" />
              </span>
            )}
            {block.members.length > 0 ? (
              <ul className="wix-person-kids">
                {block.members.map((child) => (
                  <li key={child._id}>
                    <Link href={`/family/${child.slug}`} className="wix-person-kid">
                      {/* the original showed a childhood photo here, not the portrait from the child's own page */}
                      <PersonPortrait image={child.treePhoto?.url ? child.treePhoto : child.portrait} name={child.title} width={99} height={121} />
                      <span className="wix-child-name wix-person-kid-name">{firstName(child)}</span>
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
