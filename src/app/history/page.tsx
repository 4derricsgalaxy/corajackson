import type { Metadata } from "next";
import { CmsImage } from "@/components/ui/CmsImage";
import { ContentPage, ContentTitle, PeopleLinks } from "@/components/wix/content/ContentPage";
import { WixRichText } from "@/components/wix/content/WixRichText";
import { editableField } from "@/lib/cms/sdk";
import { getFamilyGraph, getHistory, getSettings } from "@/lib/content/queries";
import type { TreeNode } from "@/lib/content/types";

export const revalidate = 3600;
export const metadata: Metadata = { title: "History", description: "The story of the Jackson family, from Brinkley, Arkansas onward." };

export default async function HistoryPage() {
  const [entries, graph, settings] = await Promise.all([getHistory(), getFamilyGraph(), getSettings()]);
  return (
    <ContentPage footerText={settings.footerText}>
      {/* The title sits inside the column flow, so the second column starts beside it like the original. */}
      <div className="wix-content-columns">
        <ContentTitle className="wix-content-title-history">Family History</ContentTitle>
        {entries.map((e) => {
          const people = (e.peopleIds ?? []).map((id) => graph.byId.get(id)).filter((p): p is TreeNode => Boolean(p));
          const when = e.dateLabel ?? (e.year !== undefined ? String(e.year) : undefined);
          return (
            <article key={e._id} className="wix-content-entry">
              <h2 className="wix-content-heading">
                {when && <span {...editableField(e._id, e.dateLabel ? "dateLabel" : "year")}>{when}</span>}
                {when && e.title ? " — " : null}
                <span {...editableField(e._id, "title")}>{e.title}</span>
              </h2>
              {e.location && <p className="wix-content-meta" {...editableField(e._id, "location")}>{e.location}</p>}
              <WixRichText content={e.body} {...editableField(e._id, "body")} />
              {e.image && (
                <div className="wix-content-figure" {...editableField(e._id, "image")}>
                  <CmsImage src={e.image} alt={e.image.alt || e.title} width={300} sizes="(max-width: 979px) 90vw, 300px" className="wix-photo wix-content-img" />
                </div>
              )}
              <PeopleLinks people={people} />
            </article>
          );
        })}
        {entries.length === 0 && <p className="wix-content-empty">Family history entries will appear here.</p>}
      </div>
    </ContentPage>
  );
}
