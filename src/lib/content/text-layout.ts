import type { CSSProperties } from "react";

/**
 * Per-page text layout: font, size, style, weight, color and a drag offset for any text item that
 * carries a layout key. Stored on the page's own CMS entry in the `textLayout` list (one row per
 * item), written by the on-page Layout tool (components/wix/layout/TextLayoutEditor.tsx).
 * Shared by the server render and the editor so both apply a row the same way.
 */
export interface TextLayoutRow {
  key: string;
  font?: string;
  size?: number;
  style?: "Italic" | "Upright";
  weight?: "Regular" | "Bold";
  color?: string;
  x?: number;
  y?: number;
}

/** The CMS "Font" options -> font stacks (the --font-bio-* variables come from app/fonts.ts). */
export const TEXT_FONTS: Record<string, string> = {
  "Playfair Display": "var(--font-bio-playfair), Didot, Georgia, serif",
  Lora: "var(--font-bio-lora), Georgia, serif",
  Merriweather: "var(--font-bio-merriweather), Georgia, serif",
  Besley: "var(--font-bio-besley), Georgia, serif",
  "Nunito Sans": "var(--font-bio-nunito), Arial, sans-serif",
  Montserrat: "var(--font-bio-montserrat), Arial, sans-serif",
  Poppins: "var(--font-bio-poppins), Arial, sans-serif",
  "Open Sans": "var(--font-bio-opensans), Arial, sans-serif",
  "Dancing Script": "var(--font-bio-dancing), cursive",
  "Great Vibes": "var(--font-bio-greatvibes), cursive",
  Georgia: "Georgia, serif",
  Arial: "Arial, Helvetica, sans-serif",
  "Times New Roman": "'Times New Roman', Times, serif",
};

/** What the Layout tool calls each item. Keys not listed show as typed. */
export const TEXT_LABELS: Record<string, string> = {
  name: "Name",
  facts: "Facts beside the portrait",
  "fact-birthDate": "Born",
  "fact-deathDate": "Passed",
  "fact-birthplace": "Place",
  "fact-residence": "Resides",
  "fact-spouse": "Spouse",
  "fact-occupation": "Life & Work",
  "fact-families": "Other parent",
  "fact-parentNote": "Other parent",
  "write-up": "Write-up",
  "children-heading": "Children heading",
  "memories-heading": "Memories heading",
  "stories-heading": "Stories heading",
  "stories-list": "Stories list",
  "home-title": "Home title",
  "home-intro": "Home intro",
  "home-btn-meet": "Meet the Family button",
  "home-btn-tree": "Family Tree button",
  "home-footer": "Footer label",
  title: "Title",
  byline: "Told by / date",
  body: "Text",
  people: "People links",
  "stories-title": "Page title",
  "history-title": "Page title",
  "list-title": "Story title",
  "list-meta": "Told by / date",
  "list-excerpt": "Excerpt",
  heading: "Heading",
  location: "Location",
};

/** Any id -> a valid layout key fragment ("member_sam" -> "member-sam"). */
export const keyPart = (s: string) => s.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 30) || "x";

export const KEY_RE = /^[a-z0-9][a-zA-Z0-9-]{0,39}$/;
export const DOC_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const clampNum = (v: unknown, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v))) : undefined;

/** Keep only valid values; undefined when the row changes nothing. */
export function cleanRow(input: unknown): TextLayoutRow | undefined {
  if (!input || typeof input !== "object") return undefined;
  const r = input as Record<string, unknown>;
  if (typeof r.key !== "string" || !KEY_RE.test(r.key)) return undefined;
  const row: TextLayoutRow = { key: r.key };
  if (typeof r.font === "string" && TEXT_FONTS[r.font]) row.font = r.font;
  const size = clampNum(r.size, 8, 120);
  if (size) row.size = size;
  if (r.style === "Italic" || r.style === "Upright") row.style = r.style;
  if (r.weight === "Regular" || r.weight === "Bold") row.weight = r.weight;
  if (typeof r.color === "string" && COLOR_RE.test(r.color)) row.color = r.color.toLowerCase();
  const x = clampNum(r.x, -2000, 2000);
  const y = clampNum(r.y, -4000, 4000);
  if (x) row.x = x;
  if (y) row.y = y;
  return Object.keys(row).length > 1 ? row : undefined;
}

/** CMS value -> rows (invalid rows dropped). */
export function parseTextLayout(v: unknown): TextLayoutRow[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const rows = v.map(cleanRow).filter((r): r is TextLayoutRow => Boolean(r));
  return rows.length ? rows : undefined;
}

/** A row as CSS variables + flag attributes; the rules in globals.css ("Text layout") do the rest. */
export function rowToCss(row: TextLayoutRow | undefined): { vars: Record<string, string>; flags: Record<string, string> } {
  const vars: Record<string, string> = {};
  const flags: Record<string, string> = {};
  if (!row) return { vars, flags };
  if (row.font && TEXT_FONTS[row.font]) { vars["--tl-font"] = TEXT_FONTS[row.font]; flags["data-tl-font"] = ""; }
  if (row.size) { vars["--tl-size"] = `${row.size}px`; flags["data-tl-size"] = ""; }
  if (row.style) { vars["--tl-style"] = row.style === "Italic" ? "italic" : "normal"; flags["data-tl-style"] = ""; }
  if (row.weight) { vars["--tl-weight"] = row.weight === "Bold" ? "700" : "400"; flags["data-tl-weight"] = ""; }
  if (row.color) { vars["--tl-color"] = row.color; flags["data-tl-color"] = ""; }
  if (row.x || row.y) { vars["--tl-x"] = `${row.x ?? 0}px`; vars["--tl-y"] = `${row.y ?? 0}px`; flags["data-tl-moved"] = ""; }
  return { vars, flags };
}

/**
 * Props for one text item: `const t = textLayout(doc._id, doc.textLayout)`, then `<h1 {...t("name")}>`.
 * Pass the element's own style as the 2nd argument so both apply, and a label for the Layout
 * toolbar when the key alone would not say which item it is. Without a doc id (local content) the
 * item just renders normally.
 */
export function textLayout(docId: string | undefined, rows: TextLayoutRow[] | undefined) {
  return (key: string, style?: CSSProperties, label?: string) => {
    if (!docId) return style ? { style } : {};
    const row = rows?.find((r) => r.key === key);
    const { vars, flags } = rowToCss(row);
    const merged = style || Object.keys(vars).length ? ({ ...style, ...vars } as CSSProperties) : undefined;
    return {
      "data-tl-doc": docId,
      "data-tl-key": key,
      ...(label ? { "data-tl-label": label } : {}),
      ...(row ? { "data-tl-row": JSON.stringify(row) } : {}),
      ...flags,
      ...(merged ? { style: merged } : {}),
    };
  };
}
