import fs from "node:fs";
import path from "node:path";
import { fromWix } from "../content/image";
import type { FamilyMember, HistoryEntry, Photo, SiteSettings, Story } from "../content/types";

export interface LocalContent {
  settings: SiteSettings;
  members: FamilyMember[];
  stories: Story[];
  photos: Photo[];
  history: HistoryEntry[];
}

let cached: LocalContent | null = null;
const SEED_FILE = path.join(process.cwd(), "content", "seed.json");

/** content/seed.json still stores Wix media URIs; convert them to SiteImage on load. */
export function loadLocalContent(): LocalContent {
  if (cached) return cached;
  if (!fs.existsSync(SEED_FILE)) {
    cached = { settings: { title: "Family Heritage of Cora Mae Jackson" }, members: [], stories: [], photos: [], history: [] };
    return cached;
  }
  const raw = JSON.parse(fs.readFileSync(SEED_FILE, "utf8")) as Record<string, unknown>;
  const img = (v: unknown, alt?: string) => fromWix(v, alt);
  const imgs = (v: unknown) => (Array.isArray(v) ? v.map((x) => fromWix(x)).filter(Boolean) as FamilyMember["gallery"] : undefined);
  const members = ((raw.members as Record<string, unknown>[]) ?? []).map((m) => ({ ...m, portrait: img(m.portrait, m.title as string), treePhoto: img(m.treePhoto, m.title as string), heroImage: img(m.heroImage), gallery: imgs(m.gallery) })) as unknown as FamilyMember[];
  const photos = ((raw.photos as Record<string, unknown>[]) ?? []).map((p) => ({ ...p, image: img(p.image, (p.caption ?? p.title) as string) })).filter((p) => p.image) as unknown as Photo[];
  const stories = ((raw.stories as Record<string, unknown>[]) ?? []).map((s) => ({ ...s, coverImage: img(s.coverImage), gallery: imgs(s.gallery) })) as unknown as Story[];
  const history = ((raw.history as Record<string, unknown>[]) ?? []).map((h) => ({ ...h, image: img(h.image) })) as unknown as HistoryEntry[];
  const s = (raw.settings as Record<string, unknown>) ?? {};
  const settings = { ...s, heroImage: img(s.heroImage), treeImage: img(s.treeImage), backgroundImage: img(s.backgroundImage) } as unknown as SiteSettings;
  cached = { settings, members, stories, photos, history };
  return cached;
}
