/**
 * Dumps the entire Wix CMS (FamilyMembers, Photos, Stories, HistoryEntries,
 * SiteSettings) to content/wix-cms-dump.json so it can be migrated to Snackbox.
 * Uses the same anonymous headless client the site uses.
 */
import fs from "node:fs";
import { createClient, OAuthStrategy } from "@wix/sdk";
import { items } from "@wix/data";

const clientId = process.env.NEXT_PUBLIC_WIX_CLIENT_ID || fs.readFileSync(".env.local", "utf8").match(/NEXT_PUBLIC_WIX_CLIENT_ID=(.+)/)[1].trim();
const client = createClient({ modules: { items }, auth: OAuthStrategy({ clientId }) });

async function all(collection, include = []) {
  const out = [];
  for (let skip = 0; skip < 5000; skip += 100) {
    let q = client.items.query(collection).limit(100).skip(skip);
    if (include.length) q = q.include(...include);
    const res = await q.find();
    out.push(...res.items.map((i) => i.data ?? i));
    if (res.items.length < 100) break;
  }
  return out;
}

const dump = {
  members: await all("FamilyMembers"),
  photos: await all("Photos", ["people"]),
  stories: await all("Stories", ["people"]),
  history: await all("HistoryEntries", ["people"]),
  settings: (await all("SiteSettings"))[0] ?? null,
};
fs.writeFileSync("content/wix-cms-dump.json", JSON.stringify(dump, null, 1));
const withPeople = dump.photos.filter((p) => Array.isArray(p.people) && p.people.length).length;
console.log({ members: dump.members.length, photos: dump.photos.length, photosWithPeople: withPeople, stories: dump.stories.length, history: dump.history.length, settings: !!dump.settings });
console.log("sample photo:", JSON.stringify(dump.photos.find((p) => Array.isArray(p.people) && p.people.length)).slice(0, 600));
console.log("sample member:", JSON.stringify(dump.members.find((m) => m.slug === "corey")).slice(0, 500));
