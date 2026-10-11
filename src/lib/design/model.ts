import { cleanCrop, type ImageCrop } from "@/lib/content/crop";

/**
 * Page designs: what the on-page Design tool changes on one page, stored as JSON in that page's
 * `pageDesign` entry (one per page address). Shared by the server render, the editor and the save route.
 *
 * - `items`: changes to the page's own pieces (anything carrying data-pd="key"): moved, resized, font,
 *   colors, border, hidden... The page itself (content, order) is untouched; an empty design = the
 *   built-in format.
 * - `added`: things added on this page: text boxes, pictures, shapes, and pasted copies of other pieces.
 * - `page`: the page's background (color, picture, artwork) and the gray surround.
 *
 * Geometry is in CSS px of the page canvas at full width (980px, the tree page 744px).
 */

export interface Look {
  /** moved by (built-in pieces) / placed at (added things), px */
  x?: number;
  y?: number;
  /** size, px */
  w?: number;
  h?: number;
  rotate?: number;
  font?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  align?: "left" | "center" | "right";
  /** fill color, or "none" for see-through */
  bg?: string;
  /** 0-100 */
  opacity?: number;
  radius?: number;
  borderW?: number;
  borderC?: string;
  shadow?: boolean;
  /** stacking order: higher = in front */
  z?: number;
  /** deleted / cut from this page (kept so it can be brought back) */
  hidden?: boolean;
}

export type AddedKind = "text" | "image" | "box" | "html";

export interface Added extends Look {
  id: string;
  kind: AddedKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** behind the page's own pieces (background) or in front of them */
  layer: "front" | "back";
  text?: string;
  src?: string;
  srcset?: string;
  alt?: string;
  fit?: "cover" | "contain";
  /** the picture's own size, for cropping */
  iw?: number;
  ih?: number;
  crop?: ImageCrop;
  href?: string;
  /** a copied piece of another page, as cleaned HTML */
  html?: string;
  /** what the piece was called where it was copied from */
  label?: string;
}

export interface PageLook {
  color?: string;
  image?: string;
  imageFit?: "cover" | "contain" | "tile";
  /** 0-100 */
  imageOpacity?: number;
  surround?: string;
}

export interface Design {
  v: 1;
  items: Record<string, Look>;
  added: Added[];
  page: PageLook;
}

export const emptyDesign = (): Design => ({ v: 1, items: {}, added: [], page: {} });

export const isEmptyDesign = (d: Design | null | undefined) =>
  !d || (!Object.keys(d.items).length && !d.added.length && !Object.keys(d.page).length);

/** Fonts offered by the Design tool -> font stacks (the --font-bio-* variables come from app/fonts.ts). */
export const FONTS: Record<string, string> = {
  "Proxima Nova": "var(--font-proxima), Arial, sans-serif",
  "Playfair Display": "var(--font-bio-playfair), Didot, Georgia, serif",
  Didot: "var(--font-didot), Didot, 'Bodoni MT', Georgia, serif",
  Lora: "var(--font-bio-lora), Georgia, serif",
  Merriweather: "var(--font-bio-merriweather), Georgia, serif",
  Besley: "var(--font-bio-besley), Georgia, serif",
  Clarendon: "var(--font-clarendon), Clarendon, Georgia, serif",
  "Nunito Sans": "var(--font-bio-nunito), Arial, sans-serif",
  Montserrat: "var(--font-bio-montserrat), Arial, sans-serif",
  Poppins: "var(--font-bio-poppins), Arial, sans-serif",
  "Open Sans": "var(--font-bio-opensans), Arial, sans-serif",
  Lulo: "var(--font-lulo), Arial, sans-serif",
  "Dancing Script": "var(--font-bio-dancing), cursive",
  "Great Vibes": "var(--font-bio-greatvibes), cursive",
  Georgia: "Georgia, serif",
  Arial: "Arial, Helvetica, sans-serif",
  "Times New Roman": "'Times New Roman', Times, serif",
};

/* ---------- cleaning: anything that comes from a browser or the CMS goes through here ---------- */

export const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const ID_RE = /^[a-z0-9]{4,24}$/;
const COLOR_RE = /^#[0-9a-f]{6}$/;
const MAX_ADDED = 200;
const MAX_ITEMS = 600;
const MAX_TEXT = 5000;
const MAX_HTML = 60_000;

const num = (v: unknown, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v)) * 10) / 10 : undefined;
const color = (v: unknown) => (typeof v === "string" && COLOR_RE.test(v.toLowerCase()) ? v.toLowerCase() : undefined);
const url = (v: unknown) => (typeof v === "string" && /^(https:\/\/|\/(?!\/))[^\s"'<>()\\]{1,2000}$/.test(v) ? v : undefined);
const link = (v: unknown) => (typeof v === "string" && /^(https?:\/\/|\/(?!\/)|mailto:)[^\s"'<>\\]{0,2000}$/.test(v) ? v : undefined);

function cleanLook(input: unknown, added = false): Look {
  const r = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Look = {};
  const set = <K extends keyof Look>(k: K, v: Look[K] | undefined) => {
    if (v !== undefined) out[k] = v;
  };
  set("x", num(r.x, added ? -500 : -3000, 3000));
  set("y", num(r.y, added ? -500 : -6000, 20000));
  set("w", num(r.w, 4, 3000));
  set("h", num(r.h, 4, 6000));
  set("rotate", num(r.rotate, -360, 360) || undefined);
  if (typeof r.font === "string" && FONTS[r.font]) out.font = r.font;
  set("size", num(r.size, 6, 200));
  for (const k of ["bold", "italic", "underline", "shadow", "hidden"] as const) if (typeof r[k] === "boolean") out[k] = r[k] as boolean;
  set("color", color(r.color));
  if (r.align === "left" || r.align === "center" || r.align === "right") out.align = r.align;
  set("bg", r.bg === "none" ? "none" : color(r.bg));
  set("opacity", num(r.opacity, 0, 100));
  set("radius", num(r.radius, 0, 1000));
  set("borderW", num(r.borderW, 0, 60));
  set("borderC", color(r.borderC));
  set("z", num(r.z, -50, 500));
  return out;
}

/** Strip anything that can run code from a copied piece of page (the save route runs this on every save). */
export function cleanHtml(html: string): string {
  return html
    .slice(0, MAX_HTML)
    .replace(/<\s*(script|style|iframe|object|embed|template|noscript|form|input|textarea|select|button|link|meta|base)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, "")
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|template|noscript|form|input|textarea|select|button|link|meta|base)\b[^>]*>/gi, "")
    .replace(/\s(on[a-z]+|srcdoc|formaction|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|srcset|action)\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi, "")
    .replace(/url\(\s*(['"]?)\s*(javascript|vbscript):[^)]*\)/gi, "none")
    .replace(/expression\s*\(/gi, "(");
}

export function cleanDesign(input: unknown): Design {
  const d = emptyDesign();
  if (!input || typeof input !== "object") return d;
  const r = input as Record<string, unknown>;
  const items = r.items && typeof r.items === "object" ? (r.items as Record<string, unknown>) : {};
  for (const [key, v] of Object.entries(items).slice(0, MAX_ITEMS)) {
    if (!KEY_RE.test(key)) continue;
    const look = cleanLook(v);
    if (Object.keys(look).length) d.items[key] = look;
  }
  const seen = new Set<string>();
  for (const v of (Array.isArray(r.added) ? r.added : []).slice(0, MAX_ADDED)) {
    const a = (v ?? {}) as Record<string, unknown>;
    const kind = a.kind;
    if (typeof a.id !== "string" || !ID_RE.test(a.id) || seen.has(a.id)) continue;
    if (kind !== "text" && kind !== "image" && kind !== "box" && kind !== "html") continue;
    const look = cleanLook(a, true);
    const item: Added = {
      ...look,
      id: a.id,
      kind,
      x: look.x ?? 0,
      y: look.y ?? 0,
      w: look.w ?? 200,
      h: look.h ?? 60,
      layer: a.layer === "back" ? "back" : "front",
    };
    if (typeof a.text === "string") item.text = a.text.slice(0, MAX_TEXT);
    const src = url(a.src);
    if (src) item.src = src;
    if (typeof a.srcset === "string" && a.srcset.length < 4000 && !/["'<>()\\]|javascript:/i.test(a.srcset)) item.srcset = a.srcset;
    if (typeof a.alt === "string") item.alt = a.alt.slice(0, 300);
    if (a.fit === "cover" || a.fit === "contain") item.fit = a.fit;
    const iw = num(a.iw, 1, 20000);
    const ih = num(a.ih, 1, 20000);
    if (iw && ih) { item.iw = iw; item.ih = ih; }
    const crop = cleanCrop(a.crop);
    if (crop) item.crop = crop;
    const href = link(a.href);
    if (href) item.href = href;
    if (typeof a.html === "string" && kind === "html") item.html = cleanHtml(a.html);
    if (typeof a.label === "string") item.label = a.label.slice(0, 120);
    if (kind === "image" && !item.src) continue;
    if (kind === "html" && !item.html) continue;
    seen.add(item.id);
    d.added.push(item);
  }
  const p = (r.page && typeof r.page === "object" ? r.page : {}) as Record<string, unknown>;
  const pc = color(p.color);
  if (pc) d.page.color = pc;
  const img = url(p.image);
  if (img) d.page.image = img;
  if (p.imageFit === "cover" || p.imageFit === "contain" || p.imageFit === "tile") d.page.imageFit = p.imageFit;
  const io = num(p.imageOpacity, 0, 100);
  if (io !== undefined) d.page.imageOpacity = io;
  const sc = color(p.surround);
  if (sc) d.page.surround = sc;
  return d;
}

export function parseDesign(json: unknown): Design | undefined {
  if (typeof json !== "string" || !json.trim()) return undefined;
  try {
    const d = cleanDesign(JSON.parse(json));
    return isEmptyDesign(d) ? undefined : d;
  } catch {
    return undefined;
  }
}

/* ---------- CSS ---------- */

/** a data-pd key -> its selector (keys are already limited to [A-Za-z0-9_-]) */
export const sel = (key: string) => `[data-pd="${key}"]`;

/** The look of one piece as CSS declarations (all !important: they must beat the page's own rules). */
export function lookDecls(look: Look, opts: { geometry: boolean; added?: boolean }): { self: string[]; text: string[] } {
  const self: string[] = [];
  const text: string[] = [];
  const imp = (s: string) => `${s} !important`;
  if (opts.geometry && !opts.added) {
    if (look.x || look.y) self.push(imp(`translate: ${look.x ?? 0}px ${look.y ?? 0}px`));
    if (look.w) self.push(imp(`width: ${look.w}px`), imp("max-width: none"), imp("box-sizing: border-box"));
    if (look.h) self.push(imp(`height: ${look.h}px`), imp("min-height: 0"), imp("box-sizing: border-box"));
  }
  if (look.rotate) self.push(imp(`rotate: ${look.rotate}deg`));
  if (look.bg) self.push(imp(`background: ${look.bg === "none" ? "transparent" : look.bg}`));
  if (look.opacity !== undefined) self.push(imp(`opacity: ${look.opacity / 100}`));
  if (look.radius !== undefined) self.push(imp(`border-radius: ${look.radius}px`), imp("overflow: hidden"));
  if (look.borderW !== undefined) self.push(imp(`border: ${look.borderW}px solid ${look.borderC ?? "#000000"}`));
  if (look.shadow !== undefined) self.push(imp(`box-shadow: ${look.shadow ? "0 6px 18px rgb(0 0 0 / 0.35)" : "none"}`));
  if (look.z !== undefined) self.push(imp(`z-index: ${look.z}`));
  if (look.align) self.push(imp(`text-align: ${look.align}`));
  if (look.font && FONTS[look.font]) text.push(imp(`font-family: ${FONTS[look.font]}`));
  if (look.size) text.push(imp(`font-size: ${look.size}px`), imp("line-height: 1.25"));
  if (look.bold !== undefined) text.push(imp(`font-weight: ${look.bold ? 700 : 400}`));
  if (look.italic !== undefined) text.push(imp(`font-style: ${look.italic ? "italic" : "normal"}`));
  if (look.underline !== undefined) text.push(imp(`text-decoration: ${look.underline ? "underline" : "none"}`));
  if (look.color) text.push(imp(`color: ${look.color}`));
  if (look.align) text.push(imp(`text-align: ${look.align}`));
  return { self, text };
}

/**
 * The page's CSS for a design: one block per changed piece, plus the page background.
 * Moves and sizes apply at full width only (on phones the page re-flows, so offsets would land wrong).
 */
export function designCss(design: Design): string {
  const out: string[] = [];
  const wide: string[] = [];
  for (const [key, look] of Object.entries(design.items)) {
    const s = sel(key);
    const { self, text } = lookDecls(look, { geometry: false });
    const geo = lookDecls({ x: look.x, y: look.y, w: look.w, h: look.h }, { geometry: true }).self;
    if (self.length) out.push(`${s}{${self.join(";")}}`);
    if (text.length) out.push(`${s},${s} *{${text.join(";")}}`);
    if (look.z !== undefined) out.push(`:where(${s}){position:relative}`);
    if (look.hidden) out.push(`html:not(.pd-editing) ${s}{visibility:hidden !important;pointer-events:none !important}`);
    if (geo.length) wide.push(`${s}{${geo.join(";")}}`);
    if (look.w || look.h) wide.push(`${s}>img,${s}>span>img,${s}>a>img{width:100% !important;height:100% !important;max-width:none !important}`);
  }
  if (wide.length) out.push(`@media (min-width:980px){${wide.join("")}}`);
  for (const a of design.added) {
    const s = `[data-pd-id="${a.id}"]`;
    const { self, text } = lookDecls(a, { geometry: false, added: true });
    if (self.length) out.push(`${s}{${self.join(";")}}`);
    if (text.length) out.push(`${s},${s} *{${text.join(";")}}`);
  }
  const p = design.page;
  if (p.color) out.push(`.wix-canvas{background:${p.color} !important}`);
  if (p.surround) out.push(`html,body{background:${p.surround} !important}`);
  return out.join("\n");
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** page address -> its pageDesign entry id */
export function designDocId(path: string): string {
  const slug = path.replace(/^\/+|\/+$/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `design-${slug || "home"}`.slice(0, 80);
}

export const PATH_RE = /^\/[a-z0-9/_-]{0,200}$/i;
