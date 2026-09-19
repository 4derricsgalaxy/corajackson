import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { CmsImage } from "@/components/ui/CmsImage";
import { WixCanvas } from "@/components/wix/WixCanvas";
import { HomeButton, footerLabelText } from "@/components/wix/WixNav";
import { TreeFrame, initialsOf } from "@/components/wix/tree/TreeFrame";
import { TREE_CENTER, TREE_STAGE, assignSlots } from "@/components/wix/tree/slots";
import { editableField } from "@/lib/cms/sdk";
import { getFamilyGraph, getSettings } from "@/lib/content/queries";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Family Tree",
  description: "Cora Mae Jackson and her children — choose a photo to open that person's page.",
};

/**
 * Family Tree — the original narrow (744px) teal canvas: Cora framed in the middle of the
 * tree with her children around her in coloured photo frames.
 */
export default async function FamilyTreePage() {
  const [settings, graph] = await Promise.all([getSettings(), getFamilyGraph()]);
  const cora = graph.root;
  const { placed, extra } = assignSlots(graph.lines);
  const familyText = footerLabelText(settings.footerText);
  const centerVars = {
    "--x": TREE_CENTER.x,
    "--y": TREE_CENTER.y,
    "--w": TREE_CENTER.w,
    "--h": TREE_CENTER.h,
  } as React.CSSProperties;

  return (
    <WixCanvas width={TREE_STAGE.width} background="#9db8b2" className="wix-tree-canvas">
      <div className="wix-tree-inner">
        <div className="wix-tree-stage">
          <h1 className="wix-tree-title">Family Tree</h1>

          {placed.map(({ member, slot }) => (
            <TreeFrame key={member._id} member={member} slot={slot} />
          ))}

          {cora && (
            <Link href={`/family/${cora.slug}`} title={cora.title} aria-label={cora.title} className="wix-tree-center" style={centerVars}>
              <span className="wix-tree-center-photo" {...editableField(cora._id, "portrait")}>
                {cora.portrait?.url ? (
                  <CmsImage src={cora.portrait} alt={cora.title} width={TREE_CENTER.photoW * 2} height={TREE_CENTER.photoH * 2} priority sizes={`${TREE_CENTER.photoW}px`} />
                ) : (
                  <span className="wix-tree-initials" aria-hidden>
                    {initialsOf(cora.title)}
                  </span>
                )}
              </span>
            </Link>
          )}
        </div>

        {extra.length > 0 && (
          <div className="wix-tree-extra">
            {extra.map(({ member, slot }) => (
              <TreeFrame key={member._id} member={member} slot={slot} inFlow />
            ))}
          </div>
        )}

        <p className={clsx("wix-tree-family", familyText.length > 36 && "wix-tree-family-long")} {...(settings._id ? editableField(settings._id, "footerText") : {})}>
          {familyText}
        </p>
        <div className="wix-tree-home">
          <HomeButton large />
        </div>
      </div>
    </WixCanvas>
  );
}
