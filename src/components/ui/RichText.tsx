import { PortableText, type PortableTextComponents } from "@portabletext/react";
import { clsx } from "clsx";
import type { RichContent } from "@/lib/content/types";

const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => <p>{children}</p>,
    h2: ({ children }) => <h2 className="mt-10 mb-4 font-display text-3xl">{children}</h2>,
    h3: ({ children }) => <h3 className="mt-8 mb-3 font-display text-2xl">{children}</h3>,
    blockquote: ({ children }) => <blockquote className="my-6 border-l-2 border-gold pl-5 font-display text-2xl italic text-ink">{children}</blockquote>,
  },
  list: {
    bullet: ({ children }) => <ul className="my-4 list-disc pl-6">{children}</ul>,
    number: ({ children }) => <ol className="my-4 list-decimal pl-6">{children}</ol>,
  },
  marks: {
    link: ({ children, value }) => <a href={(value as { href?: string })?.href} target="_blank" rel="noopener noreferrer">{children}</a>,
  },
  unknownType: () => null,
  unknownBlockStyle: ({ children }) => <p>{children}</p>,
};

function sanitize(html: string) {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

/** Renders Portable Text from the CMS, or legacy HTML/plain text from the seed. */
export function RichText({ content, className }: { content?: RichContent | null; className?: string }) {
  if (!content || (Array.isArray(content) && content.length === 0)) return null;
  if (Array.isArray(content)) {
    return (
      <div className={clsx("prose-heirloom", className)}>
        <PortableText value={content as never} components={components} />
      </div>
    );
  }
  const safe = sanitize(content);
  const looksLikeHtml = /<\w+[^>]*>/.test(safe);
  const html = looksLikeHtml ? safe : safe.split(/\n{2,}/).map((p) => `<p>${p.trim()}</p>`).join("");
  return <div className={clsx("prose-heirloom", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
