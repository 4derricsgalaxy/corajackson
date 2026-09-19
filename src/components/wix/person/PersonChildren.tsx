import Link from "next/link";
import type { TreeNode } from "@/lib/content/types";
import { PersonPortrait } from "./PersonPortrait";
import { firstName, groupByParentNote } from "./parent-note";

/** "Children" heading + one block per other-parent: note lines, then the row of child portraits. */
export function PersonChildren({ person }: { person: TreeNode }) {
  if (!person.children.length) return null;
  const groups = groupByParentNote(person.children);

  return (
    <section className="wix-person-children" aria-labelledby="wix-person-children-h">
      <h2 id="wix-person-children-h" className="wix-h2 wix-person-children-h">Children</h2>
      {groups.map((group) => (
        <div key={group.key} className="wix-person-group">
          {group.note && (
            <p className="wix-note wix-person-group-note">
              <span className="wix-person-note-line"><b>{group.note.role}:</b> {group.note.name}</span>
              {group.note.status && (
                <span className="wix-person-note-line"><b>Marital Status:</b> {group.note.status}</span>
              )}
            </p>
          )}
          <ul className="wix-person-kids">
            {group.members.map((child) => (
              <li key={child._id}>
                <Link href={`/family/${child.slug}`} className="wix-person-kid">
                  <PersonPortrait image={child.portrait} name={child.title} width={99} height={121} />
                  <span className="wix-child-name wix-person-kid-name">{firstName(child)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
