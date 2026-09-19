import type { Metadata } from "next";
import Link from "next/link";
import { CmsImage } from "@/components/ui/CmsImage";
import { WixCanvas } from "@/components/wix/WixCanvas";
import { FooterLabel, PageNav } from "@/components/wix/WixNav";
import { initialsOf } from "@/components/wix/tree/TreeFrame";
import { editableField } from "@/lib/cms/sdk";
import { getFamilyGraph, getSettings } from "@/lib/content/queries";
import type { TreeNode } from "@/lib/content/types";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Meet the Family",
  description: "Cora Mae Jackson, her children, and every generation since — grouped by family line.",
};

const shortName = (m: TreeNode) => m.nickname ?? m.title.split(" ")[0];

/** Everyone below a line's head: children first, then grandchildren, then the next generation… */
function descendantsByGeneration(head: TreeNode): TreeNode[] {
  const out: TreeNode[] = [];
  let level = head.children;
  while (level.length) {
    out.push(...level);
    level = level.flatMap((m) => m.children);
  }
  return out;
}

function Portrait({ member, width, height, priority }: { member: TreeNode; width: number; height: number; priority?: boolean }) {
  return member.portrait?.url ? (
    <CmsImage
      src={member.portrait}
      alt={member.title}
      width={width}
      height={height}
      priority={priority}
      sizes={`${width}px`}
      className="wix-photo wix-famidx-img"
    />
  ) : (
    <span className="wix-famidx-blank" style={{ width, height }} aria-hidden>
      {initialsOf(member.title)}
    </span>
  );
}

function PersonTile({ member }: { member: TreeNode }) {
  return (
    <Link href={`/family/${member.slug}`} title={member.title} className="wix-famidx-tile">
      <span className="wix-famidx-tile-photo" {...editableField(member._id, "portrait")}>
        <Portrait member={member} width={99} height={121} />
      </span>
      <span className="wix-child-name wix-famidx-tile-name" {...editableField(member._id, member.nickname ? "nickname" : "title")}>
        {shortName(member)}
      </span>
    </Link>
  );
}

/**
 * Meet the Family — the original Wix site had no index page; this one is drawn in the same
 * style (white canvas, leaves, Proxima headings, shadowed photos) and lists everyone by family line.
 */
export default async function FamilyIndexPage() {
  const [settings, graph] = await Promise.all([getSettings(), getFamilyGraph()]);
  const cora = graph.root;

  return (
    <WixCanvas minHeight={857} className="wix-famidx-canvas">
      <div className="wix-famidx-body">
        <h1 className="wix-h1 wix-famidx-title">Meet the Family</h1>

        {cora && (
          <Link href={`/family/${cora.slug}`} title={cora.title} className="wix-famidx-root">
            <span className="wix-frame wix-famidx-root-frame" {...editableField(cora._id, "portrait")}>
              <Portrait member={cora} width={132} height={193} priority />
            </span>
            <span className="wix-h2 wix-famidx-root-name" {...editableField(cora._id, "title")}>
              {cora.title}
            </span>
          </Link>
        )}

        {graph.lines.map((line) => {
          const people = descendantsByGeneration(line);
          return (
            <section key={line._id} id={line.slug} className="wix-famidx-line">
              <Link href={`/family/${line.slug}`} className="wix-famidx-line-head">
                <span className="wix-famidx-line-photo" {...editableField(line._id, "portrait")}>
                  <Portrait member={line} width={60} height={73} />
                </span>
                <h2 className="wix-h2" {...editableField(line._id, "title")}>
                  {line.title}
                </h2>
              </Link>
              {people.length > 0 && (
                <div className="wix-famidx-row">
                  {people.map((m) => (
                    <PersonTile key={m._id} member={m} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <PageNav className="wix-famidx-nav" />
      <div {...(settings._id ? editableField(settings._id, "footerText") : {})}>
        <FooterLabel text={settings.footerText} />
      </div>
    </WixCanvas>
  );
}
