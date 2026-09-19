import Link from "next/link";
import { clsx } from "clsx";

/** Round gradient home icon used at the bottom of every original page. */
export function HomeButton({ large, className }: { large?: boolean; className?: string }) {
  const s = large ? 22 : 18;
  return (
    <Link href="/" aria-label="Home" className={clsx("wix-home", large && "wix-home-lg", className)}>
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 4.2 3.5 11.4h2.3V19h4.6v-4.8h3.2V19h4.6v-7.6h2.3z" />
      </svg>
    </Link>
  );
}

/** Blue "Family Tree" pill. */
export function FamilyTreeButton({ className }: { className?: string }) {
  return (
    <Link href="/family-tree" className={clsx("wix-pill", className)}>
      Family Tree
    </Link>
  );
}

/** The home icon stacked over the Family Tree pill, centered — the footer nav of every inner page. */
export function PageNav({ className }: { className?: string }) {
  return (
    <nav aria-label="Page" className={clsx("flex flex-col items-center gap-[17px]", className)}>
      <HomeButton />
      <FamilyTreeButton />
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
export function FooterLabel({ text }: { text?: string }) {
  return <p className="wix-footer-label">{footerLabelText(text)}</p>;
}
