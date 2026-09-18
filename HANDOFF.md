# Handoff: owning the Cora Mae Jackson family site

This site is yours to run. There are three pieces, and you get access to each one separately.

| Piece | Where | What it is |
| --- | --- | --- |
| Content | Snackbox CMS, project `corajackson` at https://snackboxcms.com | Every person, photo, story, timeline entry and the home page text |
| Code | This GitHub repo | The Next.js site that turns that content into pages |
| Hosting | Vercel project `corajackson` | Builds the code on every push and serves https://corajackson.vercel.app |

## 1. Editing content (no code needed)

Most changes are content changes and never touch the code.

- Sign in to Snackbox and open the `corajackson` project, or open any page on the live site and click **Edit** in the overlay once you are signed in.
- **Add a person:** Family Members → New. Fill in the name, set **Parent** to their mother or father, set **Family line** to whichever of Cora's eight children they descend from, and set **Generation** (1 = Cora's children, 2 = grandchildren, 3 = great-grandchildren, 4 = great-great). Upload a vertical portrait. Publish. They appear on the tree, in the family list, and under their parent within seconds.
- **Add photos:** Photos → New. Upload the image, set **Family line** so it lands in the right album, and tag **People pictured** so it shows on each person's page.
- **Stories and timeline:** same pattern. The rich text editor handles headings, quotes and links.
- **Home page text, footer, hero photo:** Site settings.
- Unpublish instead of delete when you want to hide someone. Sam and Crystal are currently saved as drafts because the old site did not say which family line they belong to; set their Family line and publish when known.

Publishing pings the site automatically. If a change ever does not show up, the pages also refresh on their own every hour.

## 2. Editing code

```bash
git clone https://github.com/<your-account>/corajackson.git
cd corajackson
pnpm install
cp .env.example .env.local     # values below
pnpm dev                       # http://localhost:3000
```

`.env.local` values (also stored in Vercel, pull them with `vercel env pull .env.local`):

```
NEXT_PUBLIC_SNACKBOX_URL=https://snackboxcms.com
NEXT_PUBLIC_SNACKBOX_PROJECT=corajackson
NEXT_PUBLIC_SNACKBOX_MEDIA_HOST=media.snackboxcms.com
REVALIDATION_SECRET=<ask Camren or run scaffold_site in Snackbox>
CONTENT_SOURCE=snackbox
NEXT_PUBLIC_SITE_URL=https://corajackson.vercel.app
```

Where things live:

- `src/app/` pages: home, `family-tree`, `family/[slug]`, `gallery/[album]`, `history`, `stories/[slug]`
- `src/components/tree/` the WebGL tree (`FamilyTreeScene.tsx`) and its SVG fallback
- `src/lib/content/queries.ts` every CMS read, and the family graph built from it
- `src/lib/tree-layout.ts` branch colors and 3D positions
- `src/app/globals.css` colors, fonts, theme tokens

Push to `main` and Vercel deploys it. Preview branches get their own URL.

## 3. Hosting on Vercel

For now the Vercel project stays on Camren's account. You can still deploy and manage variables with the shared CLI:

```bash
vercel link --scope camrens-projects-24b42280 --project corajackson
vercel env ls
vercel env add NAME production
vercel deploy --prod
```

### After the GitHub repo is transferred to you

GitHub redirects the old URL, so the Vercel connection usually keeps working, but two things need to happen so pushes keep deploying:

1. Install the **Vercel GitHub app** on your GitHub account and grant it the `corajackson` repo (https://github.com/apps/vercel). Vercel can only hear about pushes from repos it is installed on.
2. In Vercel → project → Settings → Git, confirm the connected repo shows your account name. If it still shows `MistaSnacks/corajackson`, disconnect and reconnect it to `<your-account>/corajackson`. Environment variables are not affected.

Also update your local clone: `git remote set-url origin https://github.com/<your-account>/corajackson.git`.

### Moving hosting to your own Vercel account later

1. Create a Vercel account, install the Vercel GitHub app, import `corajackson` from your GitHub.
2. Add the six environment variables above (`vercel env pull` from the old project gives you the values).
3. Deploy. Then in Snackbox, update the project's site URL to the new domain and run **check site setup** so publish-to-refresh points at the new host.
4. Point the domain (if any) at the new project and delete the old one.

## Costs

- **Vercel Hobby (free)** covers this site. Pages are static, images are served by the Snackbox CDN, so Vercel's image optimizer and bandwidth caps are not in play.
- **Cloudflare Free** is enough if the domain sits there.
- **Snackbox** hosts the content and the ~1,100 photos.

## Known loose ends

- Two photos in Corey's gallery were corrupt in the old Wix export and were skipped. Re-upload them if you have the originals.
- The home page intro says "four boys and four girls"; the tree has five daughters and three sons. Fix it in Site settings.
- About 28 great-grandchildren have no portrait yet.
