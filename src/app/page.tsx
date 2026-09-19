import type { Metadata } from "next";
import Link from "next/link";
import { CmsImage } from "@/components/ui/CmsImage";
import { WixCanvas } from "@/components/wix/WixCanvas";
import { FooterLabel } from "@/components/wix/WixNav";
import { HomeIntro } from "@/components/wix/home/HomeIntro";
import { editableField } from "@/lib/cms/sdk";
import { getFamilyGraph, getSettings } from "@/lib/content/queries";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return { title: { absolute: settings.heroHeading ?? settings.title ?? "Family Heritage of Cora Mae Jackson" } };
}

/**
 * Home — the original Wix landing page: gray tree art behind a title, two outlined
 * buttons, Cora's framed portrait and the intro paragraph, on the 980 × 638 white canvas.
 */
export default async function HomePage() {
  const [settings, graph] = await Promise.all([getSettings(), getFamilyGraph()]);
  const cora = graph.root;
  const edit = (field: string) => (settings._id ? editableField(settings._id, field) : {});
  const portrait = settings.heroImage ?? cora?.portrait;
  const portraitEdit = settings.heroImage ? edit("heroImage") : cora ? editableField(cora._id, "portrait") : {};

  const framed = (
    <span className="wix-frame wix-home-frame" {...portraitEdit}>
      <CmsImage
        src={portrait}
        alt={cora?.title ?? "Cora Mae Jackson"}
        width={170}
        height={249}
        priority
        sizes="170px"
        className="wix-home-portrait"
      />
    </span>
  );

  return (
    <WixCanvas className="wix-home-canvas">
      <div className="wix-home-stage">
        {settings.treeImage ? (
          <span className="wix-home-tree" aria-hidden {...edit("treeImage")}>
            <CmsImage src={settings.treeImage} alt="" width={789} height={606} priority sizes="(max-width: 980px) 100vw, 789px" />
          </span>
        ) : (
          <span className="wix-home-tree" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element -- static decorative artwork */}
            <img src="/wix/tree-art.png" alt="" width={789} height={606} />
          </span>
        )}

        <h1 className="wix-home-title" {...edit(settings.heroHeading ? "heroHeading" : "title")}>
          {settings.heroHeading ?? settings.title}
        </h1>

        <Link href="/gallery" className="wix-btn-outline wix-home-btn wix-home-btn-meet">
          Meet the Family
        </Link>

        {cora ? (
          <Link href={`/family/${cora.slug}`} className="wix-home-frame-link" aria-label={cora.title}>
            {framed}
          </Link>
        ) : (
          <span className="wix-home-frame-link">{framed}</span>
        )}

        <HomeIntro content={settings.heroIntro} {...edit("heroIntro")} />

        <Link href="/family-tree" className="wix-btn-outline wix-home-btn wix-home-btn-tree">
          Family Tree
        </Link>

        <div className="wix-home-footer" {...edit("footerText")}>
          <FooterLabel text={settings.footerText} />
        </div>
      </div>
    </WixCanvas>
  );
}
