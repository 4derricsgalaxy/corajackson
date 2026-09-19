import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { RichContent } from "@/lib/content/types";

/** Everything collapses to plain bold Arial paragraphs, exactly like the original intro text box. */
const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => <p>{children}</p>,
    h2: ({ children }) => <p>{children}</p>,
    h3: ({ children }) => <p>{children}</p>,
    blockquote: ({ children }) => <p>{children}</p>,
  },
  list: {
    bullet: ({ children }) => <ul>{children}</ul>,
    number: ({ children }) => <ol>{children}</ol>,
  },
  marks: {
    link: ({ children, value }) => (
      <a href={(value as { href?: string })?.href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  },
  unknownType: () => null,
  unknownBlockStyle: ({ children }) => <p>{children}</p>,
};

const stripTags = (html: string) =>
  html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(br|\/p|\/div|\/li)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/**
 * The home page intro paragraph (Site settings → Hero intro) on its faint translucent strip.
 * Accepts Portable Text from the CMS or a legacy HTML/plain string from the seed.
 */
export function HomeIntro({ content, ...rest }: { content?: RichContent | null } & Omit<React.HTMLAttributes<HTMLDivElement>, "content">) {
  if (!content || (Array.isArray(content) && content.length === 0)) return null;
  return (
    <div className="wix-home-intro" {...rest}>
      {Array.isArray(content) ? (
        <PortableText value={content as never} components={components} />
      ) : (
        stripTags(content)
          .split(/\n+/)
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p, i) => <p key={i}>{p}</p>)
      )}
    </div>
  );
}
