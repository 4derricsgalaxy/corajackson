# Wix Classic branch — shared build spec

Branch `wix-classic` rebuilds the UI to match the ORIGINAL Wix site
(https://tony-mcmath.wixsite.com/corajackson) as exactly as practical, while keeping the
Snackbox CMS schema and the data layer (`src/lib/content/*`, `src/lib/cms/*`) UNCHANGED.

## Non-negotiables
- Do NOT change the Snackbox schema, `src/lib/content/types.ts`, `queries.ts`, `src/lib/cms/*`, the API routes, `next.config.ts`, or routes/URLs. Routes stay: `/`, `/family-tree`, `/family`, `/family/[slug]`, `/gallery`, `/gallery/[album]`, `/history`, `/stories`, `/stories/[slug]`.
- Everything rendered comes from the CMS. Nothing about a specific person is hard-coded.
- EVERY family member page uses ONE template, modeled on the original Joanne Jackson page. No per-person or per-generation layout variations (the old Wix site had variations, e.g. Nakita's page; we deliberately drop them).
- This is Next.js 16 — read `node_modules/next/dist/docs/` before using an API you're unsure of (see AGENTS.md). `params` is a Promise. Keep `export const revalidate = 3600`.
- Images: use `CmsImage` (`src/components/ui/CmsImage.tsx`) for CMS images; plain `<img>` for static art in `public/wix/`.
- On-page editing: spread `editableField(docId, "fieldName")` from `@/lib/cms/sdk` onto the element that renders a CMS field (title, bio, portrait, birthDate, etc.) so Snackbox's visual editor can target it.

## Foundation that already exists (use it, don't duplicate; don't edit without need)
- `src/app/globals.css` — Wix tokens + classes: `.wix-canvas`, `.wix-canvas-art`, `.wix-h1`, `.wix-h1-light`, `.wix-h2`, `.wix-label`, `.wix-value`, `.wix-note`, `.wix-strong`, `.wix-quote`, `.wix-child-name`, `.wix-photo`, `.wix-frame`, `.wix-btn-outline`, `.wix-pill`, `.wix-home`, `.wix-footer-label`, `.wix-side-tab`, `.wix-text-link`. Tailwind v4 utilities are available. If you need new shared CSS, APPEND a clearly commented block at the end of globals.css (other agents are appending too — keep your block self-contained, prefix class names with your area e.g. `.wix-person-*`, `.wix-tree-*`, `.wix-gallery-*`).
- `src/app/fonts.ts` — font CSS variables: `--font-proxima` (Proxima Nova stand-in), `--font-didot` (italic quote), `--font-lulo` (home buttons), `--font-clarendon` (pill), `--font-poppins` (child names). Arial is the body font.
- `src/app/layout.tsx` — no header/footer/menu (the original had none). Gray surround `#b5b5b5`.
- `src/components/wix/WixCanvas.tsx` — `<WixCanvas art="/wix/leaves.png" minHeight={857}>` the 980px white page.
- `src/components/wix/WixNav.tsx` — `HomeButton`, `FamilyTreeButton`, `PageNav` (home icon over pill), `FooterLabel`.
- `public/wix/tree-art.png` (home page gray tree, transparent PNG 1050x1200), `public/wix/tree-bg.jpg` (family-tree page teal tree background 1050x1200), `public/wix/leaves.png` (autumn leaves, person page background 1280x853).

## Reference captures of the original (READ THESE — they are the source of truth)
Folder: `C:\Users\Owner\AppData\Local\Temp\claude\C--Users-Owner\19a9e6c3-4eb9-484c-8335-f1a249fe7585\scratchpad\cap`
- `shots/<page>-d.png` desktop 1280px, `shots/<page>-m.png` 390px (the Wix site had no real mobile layout).
- `dump/<page>.json` — every text node with x/y/size/font/color, every image with position/size/URL, every background/border/shadow. Pages: home, family-tree, joanne, cora, gallery, history, stories, nakita, derrick, marietha, tammie, renae, anthony, darwin, tanya, greg, lamont, carlos, ...
- `node sum.mjs <page>` (run from that folder) prints a compact summary of a dump.
- NOTE: in the captures the canvas starts at x=150 (1280 viewport − 980 canvas)/2, and y≈50 is the (hidden) Wix ad bar. Subtract 150 from x and ~50–55 from y to get canvas-relative coordinates.

## Checking your work
A dev server is ALREADY running at http://localhost:3000 (shared by all agents). Do NOT start another dev server and do NOT run `next build` (it fights over `.next`). To screenshot your page:
```
cd "C:\Users\Owner\AppData\Local\Temp\claude\C--Users-Owner\19a9e6c3-4eb9-484c-8335-f1a249fe7585\scratchpad\cap"
node local.mjs <outName> <path>      # e.g. node local.mjs joanne /family/joanne
```
→ `shots-local/<outName>-d.png` and `-m.png`. Read them and compare side by side with `shots/…`. Iterate until the desktop render matches the original closely (positions within a few px, same sizes/weights/colors). Typecheck with `npx tsc --noEmit -p .` from the repo root (ignore errors in files you don't own, but report them).

## Mobile
The original had no mobile layout. Ours: at ≥ 980px match the original exactly; below that the canvas becomes fluid (`width:100%`), multi-column areas stack in a single column with 16–20px side padding, photos scale, nothing overflows horizontally. Keep the same fonts/colors/ornaments.

## Do not touch files outside your ownership list. Do not commit — the lead will commit.
