import Link from "next/link";
import { clsx } from "clsx";
import { WixCanvas } from "@/components/wix/WixCanvas";
import { FooterLabel, PageNav, footerLabelText } from "@/components/wix/WixNav";
import type { TreeNode } from "@/lib/content/types";

/**
 * The original History / Stories page frame: a 651px-tall white canvas, content starting
 * top-left, then the home icon + Family Tree pill centered and the footer label bottom-left.
 */
export function ContentPage({ children, footerText, className }: { children: React.ReactNode; footerText?: string; className?: string }) {
  return (
    <WixCanvas minHeight={651} className={clsx("wix-content-page", footerLabelText(footerText).length > 40 && "wix-content-long-footer", className)}>
      <div className="wix-content-main">{children}</div>
      <PageNav className="wix-content-nav" />
      <FooterLabel text={footerText} />
    </WixCanvas>
  );
}

/** Page title exactly as the original "Family History": Arial 41px/45px (measured), weight 400, black. */
export function ContentTitle({ children, className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 className={clsx("wix-content-title", className)} {...rest}>
      {children}
    </h1>
  );
}

/** Tagged family members as small underlined links to their pages. */
export function PeopleLinks({ people, label, className }: { people: TreeNode[]; label?: string; className?: string }) {
  if (!people.length) return null;
  return (
    <p className={clsx("wix-content-people", className)}>
      {label && <span className="wix-content-people-label">{label} </span>}
      {people.map((p, i) => (
        <span key={p._id}>
          {i > 0 && <span aria-hidden>, </span>}
          <Link href={`/family/${p.slug}`} className="wix-text-link">{p.title}</Link>
        </span>
      ))}
    </p>
  );
}

/** "1998-05-01" → "May 1, 1998"; "1998-05" → "May 1998"; "1998" → "1998"; anything else is shown as typed. */
export function formatStoryDate(value?: string): string | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(value.trim());
  if (!m) return value;
  const [, y, mo, d] = m;
  if (!mo) return y;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, d ? Number(d) : 1));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "long", ...(d ? { day: "numeric" } : {}) }).format(date);
}
