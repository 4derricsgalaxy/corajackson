import { editableField } from "@/lib/cms/sdk";
import type { FamilyMember } from "@/lib/content/types";
import { formatDate, splitNote } from "./parent-note";

interface Props {
  person: FamilyMember;
  /** the other parent as listed on the parent's page; wins over this person's own `parentNote` */
  otherParent?: { docId: string; field: string; label: string; value: string };
}

/** The stacked "Born: / May 19, 1955" pairs to the right of the portrait. Only fields with a value render. */
export function PersonFacts({ person, otherParent }: Props) {
  const note = otherParent ?? (person.parentNote ? { docId: person._id, field: "parentNote", ...splitNote(person.parentNote) } : null);
  const pairs: { docId?: string; field: string; label: string; value: string }[] = [];
  if (person.birthDate) pairs.push({ field: "birthDate", label: "Born:", value: formatDate(person.birthDate) });
  if (person.deathDate) pairs.push({ field: "deathDate", label: "Passed:", value: formatDate(person.deathDate) });
  if (person.birthplace) pairs.push({ field: "birthplace", label: "Place:", value: person.birthplace });
  if (person.residence) pairs.push({ field: "residence", label: "Resides:", value: person.residence });
  if (person.spouse) pairs.push({ field: "spouse", label: "Spouse:", value: person.spouse });
  if (person.occupation) pairs.push({ field: "occupation", label: "Life & Work:", value: person.occupation });
  if (note) pairs.push(note);
  if (!pairs.length) return null;

  return (
    <dl className="wix-person-facts">
      {pairs.map((p) => (
        <div key={p.field} className="wix-person-fact">
          <dt className="wix-label">{p.label}</dt>
          <dd className="wix-value" {...editableField(p.docId ?? person._id, p.field)}>{p.value}</dd>
        </div>
      ))}
    </dl>
  );
}
