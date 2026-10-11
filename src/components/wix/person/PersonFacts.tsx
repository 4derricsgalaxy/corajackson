import { editableField } from "@/lib/cms/sdk";
import type { FamilyMember } from "@/lib/content/types";
import { pd, pdWords } from "@/lib/design/keys";
import type { Look } from "@/lib/design/model";
import { formatDate, splitNote } from "./parent-note";

interface Props {
  person: FamilyMember;
  /** the other parent as listed on the parent's page; wins over this person's own `parentNote` */
  otherParent?: { docId: string; field: string; label: string; value: string };
  /** edit mode: Born / Place / Life & Work show even when empty, so they can be clicked and filled in */
  editing?: boolean;
  /** this page's Design-tool changes (re-worded labels) */
  design?: Record<string, Look>;
}

/** shown only to editors, in place of an empty value */
const EMPTY = "Click to add";

/** The stacked "Born: / May 19, 1955" pairs to the right of the portrait. Only fields with a value render (plus empty Born / Place / Life & Work while editing). */
export function PersonFacts({ person, otherParent, editing, design }: Props) {
  const note = otherParent ?? (person.parentNote ? { docId: person._id, field: "parentNote", ...splitNote(person.parentNote) } : null);
  const pairs: { docId?: string; field: string; label: string; value: string }[] = [];
  if (person.birthDate || editing) pairs.push({ field: "birthDate", label: "Born:", value: person.birthDate ? formatDate(person.birthDate) : "" });
  if (person.deathDate) pairs.push({ field: "deathDate", label: "Passed:", value: formatDate(person.deathDate) });
  if (person.birthplace || editing) pairs.push({ field: "birthplace", label: "Place:", value: person.birthplace ?? "" });
  if (person.residence) pairs.push({ field: "residence", label: "Resides:", value: person.residence });
  if (person.spouse) pairs.push({ field: "spouse", label: "Spouse:", value: person.spouse });
  if (person.occupation || editing) pairs.push({ field: "occupation", label: "Life & Work:", value: person.occupation ?? "" });
  if (note) pairs.push(note);
  if (!pairs.length) return null;
  const t = pd();
  const w = pdWords(design);

  return (
    <dl className="wix-person-facts" {...t("facts")}>
      {pairs.map((p) => (
        <div key={p.field} className="wix-person-fact" {...t(`fact-${p.field}`)}>
          <dt className="wix-label" {...w(`label-${p.field}`, p.label, `Label: ${p.label.replace(/:$/, "")}`)} />
          <dd className="wix-value" {...editableField(p.docId ?? person._id, p.field)}>
            {p.value || <span className="wix-fact-empty">{EMPTY}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
