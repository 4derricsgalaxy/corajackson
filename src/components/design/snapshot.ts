"use client";

import { cleanCrop } from "@/lib/content/crop";
import { FONTS, newId, type Added, type Look } from "@/lib/design/model";
import { largestSrc } from "./CropDialog";

/**
 * Copying a piece of a page (for Copy / Cut / Paste, also onto other pages): a picture becomes a picture,
 * plain text becomes a text box, anything bigger becomes a frozen copy of its HTML with the look it has
 * now written into it (so it looks the same wherever it is pasted).
 */

const fontCache = new Map<string, string | undefined>();

/** the Design tool font whose stack resolves to this computed font-family, if any */
export function fontKeyOf(family: string): string | undefined {
  if (fontCache.has(family)) return fontCache.get(family);
  const probe = document.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  let found: string | undefined;
  for (const [key, stack] of Object.entries(FONTS)) {
    probe.style.fontFamily = stack;
    if (getComputedStyle(probe).fontFamily === family) {
      found = key;
      break;
    }
  }
  probe.remove();
  fontCache.set(family, found);
  return found;
}

const hex = (rgb: string): string | undefined => {
  const m = rgb.match(/[\d.]+/g);
  if (!m || m.length < 3) return undefined;
  if (m.length >= 4 && Number(m[3]) === 0) return undefined;
  return `#${m.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, "0")).join("")}`;
};

/** the look a piece has on screen right now, in Design tool terms */
export function lookOf(el: Element): Look {
  const cs = getComputedStyle(el);
  const look: Look = {};
  const font = fontKeyOf(cs.fontFamily);
  if (font) look.font = font;
  look.size = Math.round(parseFloat(cs.fontSize));
  look.bold = Number(cs.fontWeight) >= 600;
  look.italic = cs.fontStyle === "italic";
  look.underline = cs.textDecorationLine.includes("underline");
  const color = hex(cs.color);
  if (color) look.color = color;
  if (cs.textAlign === "center" || cs.textAlign === "right") look.align = cs.textAlign;
  const bg = hex(cs.backgroundColor);
  if (bg) look.bg = bg;
  const radius = parseFloat(cs.borderTopLeftRadius);
  if (radius) look.radius = Math.round(radius);
  const bw = parseFloat(cs.borderTopWidth);
  if (bw && cs.borderTopStyle !== "none") {
    look.borderW = Math.round(bw);
    look.borderC = hex(cs.borderTopColor) ?? "#000000";
  }
  if (cs.boxShadow && cs.boxShadow !== "none") look.shadow = true;
  if (Number(cs.opacity) < 1) look.opacity = Math.round(Number(cs.opacity) * 100);
  return look;
}

const PROPS = [
  "display", "position", "top", "left", "right", "bottom", "box-sizing", "width", "height", "min-height",
  "margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "flex-direction", "flex-wrap", "align-items", "justify-content", "gap", "grid-template-columns", "float",
  "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-transform",
  "text-decoration-line", "white-space", "color", "background-color", "background-image", "background-size", "background-position",
  "border-top", "border-right", "border-bottom", "border-left", "border-radius", "box-shadow", "opacity",
  "object-fit", "object-position", "overflow", "list-style-type", "scale", "transform-origin", "clip-path", "vertical-align",
];

/** a frozen copy of a piece's HTML, with its current look written into every element */
function frozenHtml(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  const src = [el, ...Array.from(el.querySelectorAll("*"))];
  const dst = [clone, ...Array.from(clone.querySelectorAll("*"))];
  src.forEach((s, i) => {
    const d = dst[i] as HTMLElement | undefined;
    if (!d) return;
    const cs = getComputedStyle(s);
    const decl = PROPS.map((p) => {
      const v = cs.getPropertyValue(p);
      return v && v !== "none" && v !== "normal" && v !== "auto" ? `${p}:${v}` : "";
    }).filter(Boolean);
    if (cs.display === "none") decl.push("display:none");
    for (const a of Array.from(d.attributes)) {
      if (/^(data-|aria-|id$|class$|style$|tabindex$|on)/i.test(a.name)) d.removeAttribute(a.name);
    }
    d.setAttribute("style", decl.join(";"));
  });
  // the copy fills the box it is pasted into
  clone.style.position = "static";
  clone.style.width = "100%";
  clone.style.height = "100%";
  clone.style.margin = "0";
  clone.style.translate = "none";
  clone.style.rotate = "none";
  return clone.outerHTML;
}

/** Copy a piece of the page as a new added thing (same place, same look). */
export function snapshot(el: HTMLElement, canvas: HTMLElement, baseW: number, label: string): Added {
  const cr = canvas.getBoundingClientRect();
  const k = cr.width / baseW || 1;
  const r = el.getBoundingClientRect();
  const geo = { x: Math.round((r.left - cr.left) / k), y: Math.round(r.top - cr.top), w: Math.max(8, Math.round(r.width / k)), h: Math.max(8, Math.round(r.height)) };
  const base = { id: newId(), layer: "front" as const, label, ...geo };
  const imgs = el instanceof HTMLImageElement ? [el] : Array.from(el.querySelectorAll("img"));
  const href = (el.closest("a") ?? (el.querySelector(":scope > a") as HTMLAnchorElement | null))?.getAttribute("href") ?? undefined;

  if (imgs.length === 1 && !(el.textContent ?? "").trim()) {
    const img = imgs[0];
    let crop;
    try {
      crop = cleanCrop(JSON.parse(img.getAttribute("data-crop") ?? "null"));
    } catch {
      crop = undefined;
    }
    const look = lookOf(el);
    return {
      ...base,
      kind: "image",
      src: largestSrc(img),
      srcset: img.getAttribute("srcset") || undefined,
      alt: img.alt,
      iw: img.naturalWidth || undefined,
      ih: img.naturalHeight || undefined,
      crop,
      fit: "cover",
      href,
      radius: look.radius,
      borderW: look.borderW,
      borderC: look.borderC,
      shadow: look.shadow,
    };
  }
  if (!el.querySelector("img, svg, ul, ol, dl, table, div, section, p, h1, h2, h3, h4, li, figure")) {
    const look = lookOf(el);
    return { ...base, kind: "text", text: (el.innerText || el.textContent || "").trim(), href, ...look };
  }
  return { ...base, kind: "html", html: frozenHtml(el) };
}
