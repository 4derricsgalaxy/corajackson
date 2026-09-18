# Family Heritage of Cora Mae Jackson

Next.js 16 rebuild of the original Wix site, with Wix CMS as the content source (headless).

## How it works

- **Content lives in Wix CMS** (site `Corajackson`). Family members edit it at Wix → CMS. Nothing is hard-coded.
- **Pages are static.** Every route is pre-rendered and revalidated hourly (`revalidate = 3600`). Visitors never hit Wix; only the build/revalidation does.
- **Images come straight from Wix's CDN** (`static.wixstatic.com`) with size parameters in the URL. No Vercel image optimization, no transformation quota, no bandwidth on your account.
- **The family tree** (`/family-tree`) is a WebGL scene (Three.js via React Three Fiber) generated from the `FamilyMembers` collection. It falls back to an SVG diagram for reduced-motion or no-WebGL visitors.

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_WIX_CLIENT_ID (already set for this site)
pnpm dev
```

Set `CONTENT_SOURCE=local` in `.env.local` to render from `content/seed.json` instead of the live CMS (useful offline). Rebuild the seed from the scraped export with `node scripts/build-seed.mjs`.

## Deploy (Vercel)

1. Import the `web/` folder as a Vercel project (framework: Next.js).
2. Environment variables: `NEXT_PUBLIC_WIX_CLIENT_ID`, `NEXT_PUBLIC_SITE_URL` (your domain), `REVALIDATE_SECRET` (any long random string).
3. Optional instant refresh: in Wix, create an Automation "when a CMS item is created or updated → send HTTP request" to `POST https://<your-domain>/api/revalidate?secret=<REVALIDATE_SECRET>`. Otherwise changes appear within an hour.

If Cloudflare fronts the domain, leave HTML caching on defaults; images bypass Cloudflare entirely.

## Editing content (for the family)

See `CMS-GUIDE.md`.

## Collections

| Collection | Purpose | Key fields |
| --- | --- | --- |
| `FamilyMembers` | One item per person | `title`, `slug`, `parent` (reference), `generation`, `portrait`, `bio`, `parentNote`, `published` |
| `Photos` | Every photo | `image`, `title`, `caption`, `year`, `lineage` (reference), `people` (multi-reference), `featured` |
| `Stories` | Long-form memories | `title`, `slug`, `body`, `author`, `people`, `coverImage` |
| `HistoryEntries` | Timeline | `title`, `year`, `dateLabel`, `body`, `image`, `people` |
| `SiteSettings` | Single item | `title`, `tagline`, `heroIntro`, `heroImage`, `treeImage`, `footerText` |
