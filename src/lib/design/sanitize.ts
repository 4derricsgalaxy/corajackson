/**
 * Allow-list cleaner for the HTML of a copied piece of page (Design tool "html" items).
 *
 * It does not try to spot bad things in the input: it reads the input as tags + text and writes out a NEW
 * string containing only allowed tags, allowed attributes and allowed CSS, every value re-escaped. So
 * whatever odd spelling the input uses (`<img/onerror=…>`, `&#106;avascript:`, unquoted values…), the output
 * can't run code. Runs in the browser and on the server (no DOM needed): on every save and every page render.
 */

const KEEP = new Set(
  (
    "div span p br hr h1 h2 h3 h4 h5 h6 strong b em i u s small sub sup mark blockquote q cite abbr time code pre " +
    "ul ol li dl dt dd figure figcaption section article header footer aside nav main a img picture source " +
    "table thead tbody tfoot tr td th caption svg g path circle ellipse rect line polyline polygon"
  ).split(" "),
);
/** dropped together with everything inside them */
const DROP_ALL = new Set(
  "script style iframe frame frameset object embed applet template noscript noembed textarea select option title xmp plaintext math foreignobject head".split(" "),
);
const VOID = new Set(["br", "hr", "img", "source"]);

const ATTRS_ANY = new Set(["style", "title", "alt", "width", "height", "lang", "dir", "colspan", "rowspan", "datetime"]);
const ATTRS_SVG = new Set(
  "viewbox xmlns fill stroke stroke-width stroke-linecap stroke-linejoin d points cx cy r rx ry x y x1 y1 x2 y2 transform opacity fill-rule clip-rule aria-hidden".split(" "),
);
const SVG_TAGS = new Set(["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon"]);

/** the CSS a frozen copy is written with (see components/design/snapshot.ts), plus the shorthands browsers report */
const CSS_PROPS = new Set(
  (
    "display position top left right bottom box-sizing width height min-height min-width max-width max-height " +
    "margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left " +
    "flex flex-flow flex-direction flex-wrap flex-grow flex-shrink flex-basis align-items align-self justify-content gap row-gap column-gap " +
    "grid-template-columns grid-template-rows float clear " +
    "font font-family font-size font-weight font-style line-height letter-spacing text-align text-transform text-decoration " +
    "text-decoration-line white-space word-break overflow-wrap color " +
    "background background-color background-image background-size background-position background-repeat " +
    "border border-width border-style border-color border-top border-right border-bottom border-left border-radius " +
    "box-shadow opacity object-fit object-position overflow overflow-x overflow-y list-style-type " +
    "scale rotate translate transform transform-origin clip-path vertical-align z-index visibility"
  ).split(" "),
);

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENT[e.toLowerCase()] ?? m;
  });
const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escText = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** a link or picture address: https, or a path on this site */
const safeUrl = (v: string, forLink: boolean) => {
  const u = v.trim().replace(/[\u0000-\u001f\s]+/g, "");
  if (/^https:\/\/[^"'<>\\]+$/i.test(u) || /^\/(?!\/)[^"'<>\\]*$/.test(u)) return u;
  if (forLink && (/^http:\/\/[^"'<>\\]+$/i.test(u) || /^mailto:[^"'<>\\]+$/i.test(u))) return u;
  return undefined;
};
const safeSrcset = (v: string) => {
  const parts = v.split(",").map((p) => p.trim()).filter(Boolean);
  const ok = parts.every((p) => {
    const [u, w, ...rest] = p.split(/\s+/);
    return !rest.length && safeUrl(u, false) && (!w || /^\d+(\.\d+)?[wx]$/.test(w));
  });
  return ok && parts.length ? parts.join(", ") : undefined;
};

/** keep only allowed CSS declarations with harmless values */
export function cleanStyle(style: string): string {
  const out: string[] = [];
  for (const decl of style.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    let value = decl.slice(i + 1).trim();
    if (!CSS_PROPS.has(prop) || !value || value.length > 1000) continue;
    // no CSS escapes / comments / at-rules / old IE script hooks / markup
    if (/[\\<>{}@]|\/\*|expression|javascript|vbscript|behavior|-moz-binding/i.test(value)) continue;
    if (prop === "position" && !/^(static|relative|absolute)$/i.test(value)) continue;
    // pictures only from https addresses
    let bad = false;
    value = value.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (_m, _q, u: string) => {
      const s = safeUrl(u, false);
      if (!s || !s.startsWith("https://") || /[()]/.test(s)) bad = true;
      return `url("${s ?? ""}")`;
    });
    if (bad || /url\(/i.test(value.replace(/url\("https:\/\/[^"()]*"\)/gi, ""))) continue;
    out.push(`${prop}:${value}`);
  }
  return out.join(";");
}

const TAG_RE = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/;
const ATTR_RE = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

export function sanitizeHtml(input: string, maxLen = 60_000): string {
  const html = input.slice(0, maxLen);
  let out = "";
  let i = 0;
  let dropDepth = 0;
  let dropTag = "";
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    const text = lt < 0 ? html.slice(i) : html.slice(i, lt);
    if (text && !dropDepth) out += escText(text);
    if (lt < 0) break;
    const rest = html.slice(lt);
    if (rest.startsWith("<!--")) {
      const end = rest.indexOf("-->");
      i = end < 0 ? html.length : lt + end + 3;
      continue;
    }
    const m = TAG_RE.exec(rest);
    if (!m) {
      if (!dropDepth) out += "&lt;";
      i = lt + 1;
      continue;
    }
    i = lt + m[0].length;
    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    if (dropDepth) {
      if (name === dropTag) dropDepth += closing ? -1 : 1;
      continue;
    }
    if (DROP_ALL.has(name)) {
      if (!closing && !/\/\s*$/.test(m[3])) {
        dropDepth = 1;
        dropTag = name;
      }
      continue;
    }
    if (!KEEP.has(name)) continue; // unknown tag: drop the tag, keep what is inside
    if (closing) {
      if (!VOID.has(name)) out += `</${name}>`;
      continue;
    }
    let attrs = "";
    const svg = SVG_TAGS.has(name);
    for (const a of m[3].matchAll(ATTR_RE)) {
      const an = a[1].toLowerCase();
      const raw = decode(a[2] ?? a[3] ?? a[4] ?? "");
      let v: string | undefined;
      if (an === "style") v = cleanStyle(raw) || undefined;
      else if (an === "href" && name === "a") v = safeUrl(raw, true);
      else if (an === "src" && name === "img") v = safeUrl(raw, false);
      else if (an === "srcset" && (name === "img" || name === "source")) v = safeSrcset(raw);
      else if ((an === "media" || an === "type") && name === "source") v = raw.slice(0, 200);
      else if (an === "target" && name === "a") v = raw === "_blank" ? "_blank" : undefined;
      else if (ATTRS_ANY.has(an) || (svg && ATTRS_SVG.has(an))) v = raw.slice(0, 2000);
      if (v === undefined || attrs.includes(` ${an}="`)) continue;
      attrs += ` ${an}="${escAttr(v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""))}"`;
    }
    if (name === "a" && /\starget="_blank"/.test(attrs)) attrs += ' rel="noopener noreferrer"';
    out += `<${name}${attrs}>`;
  }
  return out;
}
