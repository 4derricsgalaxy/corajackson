# Family Heritage of Cora Mae Jackson

Next.js 16 site for the Cora Mae Jackson family, with **Snackbox CMS** as the system of record.
Repo: https://github.com/MistaSnacks/corajackson · Production: https://corajackson.vercel.app

## How it works

- **Content lives in Snackbox** (project `corajackson`). Family members edit it in the Snackbox Studio or directly on the page via the edit overlay. Nothing is hard-coded.
- **Pages are static.** Every route is pre-rendered and revalidated hourly. Publishing in Snackbox hits `POST /api/revalidate` so changes appear within seconds. Visitors never touch the CMS.
- **Images come from the Snackbox media CDN** (`media.snackboxcms.com`) with a WebP srcset the CMS pre-renders on upload. No Vercel image optimizer, so no transformation quota or bandwidth on the Vercel bill.
- **The family tree** (`/family-tree`) is a WebGL scene (Three.js via React Three Fiber) generated from the `familyMember` collection, with an SVG fallback.

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in the Snackbox values (see scaffold_site) and a REVALIDATION_SECRET
pnpm dev
```

`CONTENT_SOURCE=local` renders from `content/seed.json` (the export of the original Wix site) instead of the CMS.

## Deploy

Vercel is connected to the GitHub repo: every push to `main` deploys to production. Environment variables (`NEXT_PUBLIC_SNACKBOX_URL`, `NEXT_PUBLIC_SNACKBOX_PROJECT`, `NEXT_PUBLIC_SNACKBOX_MEDIA_HOST`, `REVALIDATION_SECRET`, `CONTENT_SOURCE=snackbox`, `NEXT_PUBLIC_SITE_URL`) are set for production, preview, and development.

## Content model (Snackbox collections)

| Collection | Purpose | Key fields |
| --- | --- | --- |
| `familyMember` | One item per person | `title`, `slug`, `parent` (ref), `lineage` (ref), `generation`, `portrait`, `bio`, `parentNote` |
| `photo` | Every photo | `image`, `title`, `caption`, `year`, `lineage` (ref), `people` (list of refs), `featured` |
| `story` | Long-form memories | `title`, `slug`, `body`, `author` (ref), `people`, `coverImage` |
| `historyEntry` | Timeline | `title`, `year`, `dateLabel`, `body`, `image`, `people` |
| `siteSettings` | Singleton | `title`, `tagline`, `heroIntro`, `heroImage`, `treeImage`, `footerText` |

## Migration history

1. `content/wix-export/` (repo parent folder): scrape of the original Wix Editor site, 34 pages.
2. `scripts/build-seed.mjs` → `content/seed.json`: the hand-verified family hierarchy built from that scrape.
3. The seed was loaded into Wix CMS collections as an interim store, then dumped with `scripts/dump-wix-cms.mjs` → `content/wix-cms-dump.json`.
4. `~/CMS-stripe/scripts/ingest-corajackson.ts` imported that dump into Snackbox (assets re-hosted on the Snackbox CDN, references rewritten to `member-<slug>` / `photo-<fileId>` ids).

The Wix site can be retired; nothing reads from it anymore.
