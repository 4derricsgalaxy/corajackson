import { PortableText, type PortableTextComponents } from "@portabletext/react";
import { clsx } from "clsx";
import type { RichContent } from "@/lib/content/types";

/* Plain elements only — all styling comes from `.wix-content-rich` in globals.css (Arial, black, underlined links). */
const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => <p>{children}</p>,
    h2: ({ children }) => <h2>{children}</h2>,
    h3: ({ children }) => <h3>{children}</h3>,
    h4: ({ children }) => <h4>{children}</h4>,
    blockquote: ({ children }) => <blockquote>{children}</blockquote>,
  },
  list: {
    bullet: ({ children }) => <ul>{children}</ul>,
    number: ({ children }) => <ol>{children}</ol>,
  },
  marks: {
    link: ({ children, value }) => {
      const href = (value as { href?: string })?.href ?? "";
      const external = /^https?:\/\//i.test(href);
      return <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{children}</a>;
    },
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

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

interface Props extends Omit<React.HTMLAttributes<HTMLDivElement>, "content"> {
  content?: RichContent | null;
  /** 12 = history/list body (the original's text size), 13 = story body */
  size?: 12 | 13;
}

/**
 * Wix-classic rich text: renders Portable Text from the CMS (or legacy HTML / plain text from the
 * seed) as plain Arial paragraphs. Extra props (e.g. `editableField(...)`) land on the wrapper.
 */
export function WixRichText({ content, size = 12, className, ...rest }: Props) {
  if (!content || (Array.isArray(content) && content.length === 0)) return null;
  const cls = clsx("wix-content-rich", size === 13 && "wix-content-rich-13", className);
  if (Array.isArray(content)) {
    return (
      <div className={cls} {...rest}>
        <PortableText value={content as never} components={components} />
      </div>
    );
  }
  const safe = sanitize(content);
  const looksLikeHtml = /<\w+[^>]*>/.test(safe);
  const html = looksLikeHtml
    ? safe
    : safe.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br/>")}</p>`).join("");
  return <div className={cls} {...rest} dangerouslySetInnerHTML={{ __html: html }} />;
}
