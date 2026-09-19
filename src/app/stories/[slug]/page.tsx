import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CmsImage } from "@/components/ui/CmsImage";
import { ContentPage, ContentTitle, PeopleLinks, formatStoryDate } from "@/components/wix/content/ContentPage";
import { WixRichText } from "@/components/wix/content/WixRichText";
import { GalleryGrid } from "@/components/wix/gallery/GalleryGrid";
import { editableField } from "@/lib/cms/sdk";
import { getFamilyGraph, getSettings, getStories } from "@/lib/content/queries";
import type { TreeNode } from "@/lib/content/types";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getStories()).map((s) => ({ slug: s.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = (await getStories()).find((x) => x.slug === slug);
  return s ? { title: s.title, description: s.excerpt } : {};
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [stories, graph, settings] = await Promise.all([getStories(), getFamilyGraph(), getSettings()]);
  const story = stories.find((x) => x.slug === slug);
  if (!story) notFound();
  const people = (story.peopleIds ?? []).map((id) => graph.byId.get(id)).filter((p): p is TreeNode => Boolean(p));
  const author = story.authorId ? graph.byId.get(story.authorId) : undefined;
  const date = formatStoryDate(story.storyDate);
  const gallery = (story.gallery ?? []).map((image, i) => ({ id: `${story._id}-g${i}`, image, title: image.alt || undefined }));

  return (
    <ContentPage footerText={settings.footerText}>
      <article className="wix-content-article">
        <ContentTitle {...editableField(story._id, "title")}>{story.title}</ContentTitle>
        {(story.authorName || author || date) && (
          <p className="wix-content-meta wix-content-byline">
            {(story.authorName || author) && (
              <>
                Told by{" "}
                {story.authorName ? (
                  <span {...editableField(story._id, "authorName")}>{story.authorName}</span>
                ) : author ? (
                  <Link href={`/family/${author.slug}`} className="wix-content-meta-link">{author.title}</Link>
                ) : null}
              </>
            )}
            {(story.authorName || author) && date ? " · " : null}
            {date && <span {...editableField(story._id, "storyDate")}>{date}</span>}
          </p>
        )}
        {story.coverImage && (
          <div className="wix-content-cover" {...editableField(story._id, "coverImage")}>
            <CmsImage src={story.coverImage} alt={story.coverImage.alt || story.title} width={640} priority sizes="(max-width: 979px) 92vw, 640px" className="wix-photo wix-content-img" />
          </div>
        )}
        <WixRichText content={story.body} size={13} className="wix-content-body" {...editableField(story._id, "body")} />
        {gallery.length > 0 && (
          <div {...editableField(story._id, "gallery")}>
            <GalleryGrid items={gallery} variant="thumbs" className="wix-content-gallery" />
          </div>
        )}
        <PeopleLinks people={people} label="In this story:" className="wix-content-people-story" />
        <p className="wix-content-back">
          <Link href="/stories" className="wix-text-link">← All stories</Link>
        </p>
      </article>
    </ContentPage>
  );
}
