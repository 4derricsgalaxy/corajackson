import Link from "next/link";
import { clsx } from "clsx";
import { CmsImage } from "@/components/ui/CmsImage";
import { editableField } from "@/lib/cms/sdk";
import type { TreeNode } from "@/lib/content/types";
import type { TreeSlot } from "./slots";

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/**
 * One coloured, rounded photo frame on the family tree. Geometry is passed as unitless CSS
 * variables and multiplied by the stage unit (--u) in CSS so the whole tree scales on phones.
 * `inFlow` renders it as a normal inline item (the overflow row for a ninth+ child).
 */
export function TreeFrame({ member, slot, inFlow }: { member: TreeNode; slot: TreeSlot; inFlow?: boolean }) {
  const label = member.nickname ?? member.title.split(" ")[0];
  // the tree has its own photo (the original used childhood pictures); without one it shows the portrait
  const photo = member.treePhoto?.url ? member.treePhoto : member.portrait;
  const vars = {
    "--x": slot.frame.x,
    "--y": slot.frame.y,
    "--w": slot.frame.w,
    "--h": slot.frame.h,
    "--px": slot.photo.x,
    "--py": slot.photo.y,
    "--pw": slot.photo.w,
    "--ph": slot.photo.h,
  } as React.CSSProperties;
  return (
    <Link
      href={`/family/${member.slug}`}
      title={member.title}
      aria-label={member.title}
      className={clsx("wix-tree-slot", inFlow && "wix-tree-slot-flow")}
      style={vars}
    >
      <span className="wix-tree-frame" style={{ backgroundColor: slot.color }}>
        <span className="wix-tree-photo" {...editableField(member._id, member.treePhoto?.url ? "treePhoto" : "portrait")}>
          {photo?.url ? (
            <CmsImage src={photo} alt={member.title} width={slot.photo.w * 2} height={slot.photo.h * 2} sizes={`${slot.photo.w}px`} />
          ) : (
            <span className="wix-tree-initials" aria-hidden>
              {initialsOf(member.title)}
            </span>
          )}
        </span>
      </span>
      <span className="wix-tree-name" aria-hidden>
        {label}
      </span>
    </Link>
  );
}
