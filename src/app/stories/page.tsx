import type { Metadata } from "next";
import Link from "next/link";
import { CmsImage } from "@/components/ui/CmsImage";
import { ContentPage, ContentTitle, formatStoryDate } from "@/components/wix/content/ContentPage";
import { editableField } from "@/lib/cms/sdk";
import { getFamilyGraph, getSettings, getStories } from "@/lib/content/queries";
import { keyPart, pd } from "@/lib/design/keys";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Stories", description: "Memories and stories told by the Jackson family." };

export default async function StoriesPage() {
  const [stories, graph, settings] = await Promise.all([getStories(), getFamilyGraph(), getSettings()]);
  return (
    <ContentPage path="/stories" footerText={settings.footerText}>
      <ContentTitle {...pd()("title", undefined, "Page title")}>Family Stories</ContentTitle>
      {stories.length > 0 ? (
        <ul className="wix-content-list">
          {stories.map((s) => {
            const teller = s.authorName ?? (s.authorId ? graph.byId.get(s.authorId)?.title : undefined);
            const date = formatStoryDate(s.storyDate);
            const t = pd(keyPart(s._id));
            const meta = [teller ? `Told by ${teller}` : undefined, date].filter(Boolean).join(" · ");
            return (
              <li key={s._id} className="wix-content-story" {...t("story", undefined, `Story: ${s.title}`)}>
                {s.coverImage && (
                  <Link href={`/stories/${s.slug}`} className="wix-content-story-thumb" tabIndex={-1} aria-hidden {...editableField(s._id, "coverImage")} {...t("cover", undefined, `Cover: ${s.title}`)}>
                    <CmsImage src={s.coverImage} alt="" width={133} height={133} sizes="133px" className="wix-photo" />
                  </Link>
                )}
                <div className="wix-content-story-text">
                  <h2 className="wix-content-heading" {...t("list-title", undefined, `List title: ${s.title}`)}>
                    <Link href={`/stories/${s.slug}`} {...editableField(s._id, "title")}>{s.title}</Link>
                  </h2>
                  {meta && <p className="wix-content-meta" {...t("list-meta", undefined, `List byline: ${s.title}`)}>{meta}</p>}
                  {s.excerpt && <p className="wix-content-excerpt" {...editableField(s._id, "excerpt")} {...t("list-excerpt", undefined, `Excerpt: ${s.title}`)}>{s.excerpt}</p>}
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
