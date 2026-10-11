import type { CSSProperties } from "react";

/**
 * Marks a piece of a page for the Design tool: `const d = pd()` then `<h1 {...d("name")}>`.
 * Pieces repeated per entry get a scope so every key on a page is unique: `pd(keyPart(entry._id))`.
 * Pass the element's own style as the 2nd argument and, when the key alone would not say which piece
 * it is, a label for the Design toolbar as the 3rd.
 */
export function pd(scope?: string) {
  return (key: string, style?: CSSProperties, label?: string) => ({
    "data-pd": scope ? `${scope}--${key}` : key,
    ...(label ? { "data-pd-label": label } : {}),
    ...(style ? { style } : {}),
  });
}

/** Any id -> a valid key fragment ("member_sam" -> "member-sam"). */
export const keyPart = (s: string) => s.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 40) || "x";

/** What the Design tool calls each piece. Keys not listed show their data-pd-label, else the key. */
export const PIECE_LABELS: Record<string, string> = {
  art: "Page artwork",
  name: "Name",
  portrait: "Portrait",
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
  children: "Children section",
  "children-heading": "Children heading",
  memories: "Memories section",
  "memories-heading": "Memories heading",
  "memories-strip": "Memories photo strip",
  stories: "Stories section",
  "stories-heading": "Stories heading",
  "stories-list": "Stories list",
  nav: "Home + Family Tree buttons",
  "btn-home": "Home button",
  "btn-tree": "Family Tree button",
  footer: "Footer label",
  "side-tab": "Side tab",
  "home-tree": "Tree artwork",
  "home-title": "Home title",
  "home-intro": "Home intro",
  "home-portrait": "Cora's portrait",
  "home-btn-meet": "Meet the Family button",
  "home-btn-tree": "Family Tree button",
  title: "Title",
  byline: "Told by / date",
  cover: "Cover picture",
  body: "Text",
  people: "People links",
  gallery: "Photo gallery",
  back: "All stories link",
  list: "List",
};
