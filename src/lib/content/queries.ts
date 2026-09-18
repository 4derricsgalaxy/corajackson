import { cache } from "react";
import { site } from "../cms/client";
import { loadLocalContent } from "../data/local";
import { fromCms } from "./image";
import { TYPES, type FamilyMember, type HistoryEntry, type Photo, type SiteSettings, type Story, type TreeNode } from "./types";

type Doc = Record<string, unknown> & { _id: string; _type?: string; _order?: string };

const str = (v: unknown) => (typeof v === "string" && v.length ? v : undefined);
const num = (v: unknown) => (typeof v === "number" ? v : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const refId = (v: unknown): string | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as { _ref?: string; _id?: string };
  return o._ref ?? o._id ?? null;
};
const refIds = (v: unknown): string[] => (Array.isArray(v) ? v.map(refId).filter((x): x is string => Boolean(x)) : []);
const images = (v: unknown) => (Array.isArray(v) ? v.map(fromCms).filter((x): x is NonNullable<typeof x> => Boolean(x)) : undefined);
const rich = (v: unknown) => (Array.isArray(v) ? v : str(v));

async function fetchAll(type: string, include: string[] = []): Promise<Doc[]> {
  const out: Doc[] = [];
  const pageSize = 100;
  for (let offset = 0; offset < 10_000; offset += pageSize) {
    let q = site.query<Doc>(type).order("_order", "asc").limit(pageSize).offset(offset);
    if (include.length) q = q.include(...include);
    const page = await q.find();
    out.push(...page);
    if (page.length < pageSize) break;
  }
  return out;
}

/* ---------- mappers ---------- */
const toMember = (d: Doc): FamilyMember => ({
  _id: d._id,
  title: str(d.title) ?? "Unnamed",
  slug: str(d.slug) ?? d._id,
  nickname: str(d.nickname),
  generation: num(d.generation) ?? 0,
  parentId: refId(d.parent),
  lineageId: refId(d.lineage),
  spouse: str(d.spouse),
  parentNote: str(d.parentNote),
  birthDate: str(d.birthDate),
  deathDate: str(d.deathDate),
  birthplace: str(d.birthplace),
  residence: str(d.residence),
  occupation: str(d.occupation),
  shortBio: str(d.shortBio),
  bio: rich(d.bio),
  portrait: fromCms(d.portrait),
  heroImage: fromCms(d.heroImage),
  gallery: images(d.gallery),
  accentColor: str(d.accentColor),
  sortOrder: str(d._order),
  featured: bool(d.featured),
  published: true,
});

const toStory = (d: Doc): Story => ({
  _id: d._id,
  title: str(d.title) ?? "Untitled",
  slug: str(d.slug) ?? d._id,
  excerpt: str(d.excerpt),
  body: rich(d.body),
  coverImage: fromCms(d.coverImage),
  gallery: images(d.gallery),
  storyDate: str(d.storyDate),
  authorName: str(d.authorName),
  authorId: refId(d.author),
  peopleIds: refIds(d.people),
  sortOrder: str(d._order),
  published: true,
});

const toPhoto = (d: Doc): Photo | null => {
  const image = fromCms(d.image);
  if (!image) return null;
  return {
    _id: d._id,
    title: str(d.title) ?? "",
    image,
    caption: str(d.caption),
    year: num(d.year),
    album: str(d.album),
    lineageId: refId(d.lineage),
    peopleIds: refIds(d.people),
    featured: bool(d.featured),
    sortOrder: str(d._order),
    published: true,
  };
};

const toHistory = (d: Doc): HistoryEntry => ({
  _id: d._id,
  title: str(d.title) ?? "",
  year: num(d.year),
  dateLabel: str(d.dateLabel),
  body: rich(d.body),
  image: fromCms(d.image),
  location: str(d.location),
  peopleIds: refIds(d.people),
  sortOrder: str(d._order),
  published: true,
});

const toSettings = (d: Doc): SiteSettings => ({
  _id: d._id,
  title: str(d.title) ?? "Family Heritage of Cora Mae Jackson",
  tagline: str(d.tagline),
  heroHeading: str(d.heroHeading),
  heroIntro: rich(d.heroIntro),
  heroImage: fromCms(d.heroImage),
  treeImage: fromCms(d.treeImage),
  backgroundImage: fromCms(d.backgroundImage),
  footerText: str(d.footerText),
  contactEmail: str(d.contactEmail),
  primaryColor: str(d.primaryColor),
  accentColor: str(d.accentColor),
});

/** Sort by CMS order key (string, collation C) or numeric sortOrder, then title. */
export const bySort = <T extends { sortOrder?: number | string; title: string }>(a: T, b: T) => {
  const ka = a.sortOrder, kb = b.sortOrder;
  if (typeof ka === "number" && typeof kb === "number") return ka - kb || a.title.localeCompare(b.title);
  if (typeof ka === "string" && typeof kb === "string") return (ka < kb ? -1 : ka > kb ? 1 : 0) || a.title.localeCompare(b.title);
  if (ka === undefined && kb !== undefined) return 1;
  if (kb === undefined && ka !== undefined) return -1;
  return a.title.localeCompare(b.title);
};

const useLocalSource = () => process.env.CONTENT_SOURCE === "local";
async function withFallback<T>(remote: () => Promise<T>, local: () => T): Promise<T> {
  if (useLocalSource()) return local();
  try {
    return await remote();
  } catch (err) {
    console.warn("[snackbox] fetch failed, using local seed:", (err as Error).message);
    return local();
  }
}

/* ---------- public API ---------- */
export const getMembers = cache(async (): Promise<FamilyMember[]> =>
  withFallback(
    async () => (await fetchAll(TYPES.members, ["portrait", "heroImage", "gallery"])).map(toMember).sort(bySort),
    () => loadLocalContent().members.filter((m) => m.published !== false).sort(bySort),
  ),
);

export const getStories = cache(async (): Promise<Story[]> =>
  withFallback(
    async () => (await fetchAll(TYPES.stories, ["coverImage", "gallery"])).map(toStory).sort(bySort),
    () => loadLocalContent().stories.filter((s) => s.published !== false).sort(bySort),
  ),
);

export const getPhotos = cache(async (): Promise<Photo[]> =>
  withFallback(
    async () => (await fetchAll(TYPES.photos, ["image"])).map(toPhoto).filter((p): p is Photo => Boolean(p)).sort(bySort),
    () => loadLocalContent().photos.filter((p) => p.published !== false).sort(bySort),
  ),
);

export const getHistory = cache(async (): Promise<HistoryEntry[]> =>
  withFallback(
    async () => (await fetchAll(TYPES.history, ["image"])).map(toHistory).sort(bySort),
    () => loadLocalContent().history.filter((h) => h.published !== false).sort(bySort),
  ),
);

export const getSettings = cache(async (): Promise<SiteSettings> =>
  withFallback(
    async () => {
      const rows = await site.query<Doc>(TYPES.settings).include("heroImage", "treeImage", "backgroundImage").limit(1).find();
      return rows.length ? toSettings(rows[0]) : loadLocalContent().settings;
    },
    () => loadLocalContent().settings,
  ),
);

/* ---------- derived: the tree ---------- */
export interface FamilyGraph {
  root: TreeNode | null;
  bySlug: Map<string, TreeNode>;
  byId: Map<string, TreeNode>;
  lines: TreeNode[];
  all: TreeNode[];
}

export const getFamilyGraph = cache(async (): Promise<FamilyGraph> => {
  const members = await getMembers();
  const byId = new Map<string, TreeNode>();
  for (const m of members) byId.set(m._id, { ...m, children: [], depth: 0 });
  let root: TreeNode | null = null;
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else if (!root || node.generation < root.generation) root = node;
  }
  const bySlug = new Map<string, TreeNode>();
  const all: TreeNode[] = [];
  const walk = (n: TreeNode, depth: number, lineSlug?: string) => {
    n.depth = depth;
    n.lineSlug = depth === 1 ? n.slug : lineSlug;
    n.children.sort(bySort);
    bySlug.set(n.slug, n);
    all.push(n);
    for (const c of n.children) walk(c, depth + 1, n.lineSlug);
  };
  if (root) walk(root, 0);
  for (const n of byId.values()) if (!bySlug.has(n.slug)) walk(n, n.generation);
  return { root, bySlug, byId, lines: root ? root.children : [], all };
});

export async function getMemberBySlug(slug: string): Promise<TreeNode | undefined> {
  return (await getFamilyGraph()).bySlug.get(slug);
}

export function ancestorsOf(node: TreeNode, graph: FamilyGraph): TreeNode[] {
  const chain: TreeNode[] = [];
  let cur = node.parentId ? graph.byId.get(node.parentId) : undefined;
  while (cur) { chain.unshift(cur); cur = cur.parentId ? graph.byId.get(cur.parentId) : undefined; }
  return chain;
}

export function descendantCount(node: TreeNode): number {
  return node.children.reduce((n, c) => n + 1 + descendantCount(c), 0);
}

export function siblingsOf(node: TreeNode, graph: FamilyGraph): { prev?: TreeNode; next?: TreeNode } {
  const parent = node.parentId ? graph.byId.get(node.parentId) : undefined;
  if (!parent) return {};
  const idx = parent.children.findIndex((c) => c._id === node._id);
  return { prev: parent.children[idx - 1], next: parent.children[idx + 1] };
}
