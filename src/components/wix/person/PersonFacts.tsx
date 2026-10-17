import { editableField } from "@/lib/cms/sdk";
import type { FamilyMember } from "@/lib/content/types";
import { pd, pdWords } from "@/lib/design/keys";
import type { Look } from "@/lib/design/model";
import { formatDate } from "./parent-note";

interface Props {
  person: FamilyMember;
  /** edit mode: Born / Place / Life & Work show even when empty, so they can be clicked and filled in */
  editing?: boolean;
  /** this page's Design-tool changes (re-worded labels) */
  design?: Record<string, Look>;
}

/** shown only to editors, in place of an empty value */

/** The stacked "Born: / May 19, 1955" pairs to the right of the portrait. Only fields with a value render.
 *  While editing, empty Born / Place / Life & Work are small "+ Born" chips floating under the facts: they take no room,
 *  so edit mode is laid out exactly like the page visitors see (Design moves land where they will show).
 *  The other parent ("Mother: …" / "Father: …") is not shown here; it lives only in the Children column of the parent's page. */
export function PersonFacts({ person, editing, design }: Props) {
  const pairs: { docId?: string; field: string; label: string; value: string }[] = [];
  if (person.birthDate || editing) pairs.push({ field: "birthDate", label: "Born:", value: person.birthDate ? formatDate(person.birthDate) : "" });
  if (person.deathDate) pairs.push({ field: "deathDate", label: "Passed:", value: formatDate(person.deathDate) });
  if (person.birthplace || editing) pairs.push({ field: "birthplace", label: "Place:", value: person.birthplace ?? "" });
  if (person.residence) pairs.push({ field: "residence", label: "Resides:", value: person.residence });
  if (person.spouse) pairs.push({ field: "spouse", label: "Spouse:", value: person.spouse });
  if (person.occupation || editing) pairs.push({ field: "occupation", label: "Life & Work:", value: person.occupation ?? "" });
  const filled = pairs.filter((p) => p.value);
  const empty = pairs.filter((p) => !p.value);
  if (!pairs.length) return null;
  const t = pd();
  const w = pdWords(design);
  // (a span, so the last fact stays the last div: its spacing is the visitors')
  const adds = empty.length > 0 && (
    <span className="wix-fact-adds">
      {empty.map((p) => (
        <span key={p.field} className="wix-fact-add" role="button" tabIndex={0} title={`Add ${p.label.replace(/:$/, "")}`} {...editableField(p.docId ?? person._id, p.field)}>
          + {p.label.replace(/:$/, "")}
        </span>
      ))}
    </span>
  );
  // nothing filled in yet: no facts column (as for visitors), only the chips where it would be
  if (!filled.length) return <span className="wix-person-facts-none">{adds}</span>;

  return (
    <dl className="wix-person-facts" {...t("facts")}>
      {filled.map((p) => (
        <div key={p.field} className="wix-person-fact" {...t(`fact-${p.field}`)}>
          <dt className="wix-label" {...w(`label-${p.field}`, p.label, `Label: ${p.label.replace(/:$/, "")}`)} />
          <dd className="wix-value" {...editableField(p.docId ?? person._id, p.field)}>{p.value}</dd>
        </div>
      ))}
      {adds}
    </dl>
  );
}
