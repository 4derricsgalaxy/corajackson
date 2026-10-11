import Link from "next/link";
import { clsx } from "clsx";
import { pdWords } from "@/lib/design/keys";
import type { Look } from "@/lib/design/model";

/** Round gradient home icon used at the bottom of every original page. */
export function HomeButton({ large, className, piece }: { large?: boolean; className?: string; piece?: object }) {
  const s = large ? 22 : 18;
  return (
    <Link href="/" aria-label="Home" className={clsx("wix-home", large && "wix-home-lg", className)} {...piece}>
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 4.2 3.5 11.4h2.3V19h4.6v-4.8h3.2V19h4.6v-7.6h2.3z" />
      </svg>
    </Link>
  );
}

/** Blue "Family Tree" pill. */
export function FamilyTreeButton({ className, piece }: { className?: string; piece?: object }) {
  return (
    <Link href="/family-tree" className={clsx("wix-pill", className)} {...{ children: "Family Tree", ...piece }} />
  );
}

/** The home icon stacked over the Family Tree pill, centered — the footer nav of every inner page. */
export function PageNav({ className, layout, design }: { className?: string; layout?: object; design?: Record<string, Look> }) {
  return (
    <nav aria-label="Page" className={clsx("flex flex-col items-center gap-[17px]", className)} {...layout}>
      <HomeButton piece={{ "data-pd": "btn-home" }} />
      {/* with a page design passed in, the pill's words can be changed on that page */}
      <FamilyTreeButton piece={design ? pdWords(design)("btn-tree", "Family Tree") : { "data-pd": "btn-tree" }} />
    </nav>
  );
}

const DEFAULT_FOOTER_LABEL = "Cora Mae Jackson Family";

/**
 * The original footer was a short label. Site settings → Footer text is used when it is
 * label-sized; a full sentence (what the redesigned main site stores there) falls back to the original.
 */
export function footerLabelText(text?: string) {
  const t = text?.trim();
  return t && t.length <= 40 ? t : DEFAULT_FOOTER_LABEL;
}

/** "Cora Mae Jackson Family" label at the bottom-left of the canvas. */
export function FooterLabel({ text, layout, design }: { text?: string; layout?: object; design?: Record<string, Look> }) {
  const label = footerLabelText(text);
  return (
    <p className="wix-footer-label" {...layout}>
      {design ? <span {...pdWords(design)("footer-label", label, "Footer words")} /> : label}
      <span className="wix-footer-credit">
        Site by McMathematics · Powered by{" "}
        <a href="https://snackboxcms.com" target="_blank" rel="noopener">SnackBox</a>
      </span>
    </p>
  );
}
