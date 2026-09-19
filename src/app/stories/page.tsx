import type { Metadata } from "next";
import Link from "next/link";
import { CmsImage } from "@/components/ui/CmsImage";
import { ContentPage, ContentTitle, formatStoryDate } from "@/components/wix/content/ContentPage";
import { editableField } from "@/lib/cms/sdk";
import { getFamilyGraph, getSettings, getStories } from "@/lib/content/queries";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Stories", description: "Memories and stories told by the Jackson family." };

export default async function StoriesPage() {
  const [stories, graph, settings] = await Promise.all([getStories(), getFamilyGraph(), getSettings()]);
  return (
    <ContentPage footerText={settings.footerText}>
      <ContentTitle>Family Stories</ContentTitle>
      {stories.length > 0 ? (
        <ul className="wix-content-list">
          {stories.map((s) => {
            const teller = s.authorName ?? (s.authorId ? graph.byId.get(s.authorId)?.title : undefined);
            const date = formatStoryDate(s.storyDate);
            const meta = [teller ? `Told by ${teller}` : undefined, date].filter(Boolean).join(" · ");
            return (
              <li key={s._id} className="wix-content-story">
                {s.coverImage && (
                  <Link href={`/stories/${s.slug}`} className="wix-content-story-thumb" tabIndex={-1} aria-hidden {...editableField(s._id, "coverImage")}>
                    <CmsImage src={s.coverImage} alt="" width={133} height={133} sizes="133px" className="wix-photo" />
                  </Link>
                )}
                <div className="wix-content-story-text">
                  <h2 className="wix-content-heading">
                    <Link href={`/stories/${s.slug}`} {...editableField(s._id, "title")}>{s.title}</Link>
                  </h2>
                  {meta && <p className="wix-content-meta">{meta}</p>}
                  {s.excerpt && <p className="wix-content-excerpt" {...editableField(s._id, "excerpt")}>{s.excerpt}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="wix-content-empty wix-content-empty-stories">Family stories will appear here.</p>
      )}
    </ContentPage>
  );
}
