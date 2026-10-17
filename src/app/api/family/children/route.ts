import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireEditor, type EditorWrite } from "@/lib/cms/editor-auth";
import { actorFor, childrenAddedOn, logMutation } from "@/lib/cms/edit-log";
import { mayChange, notYours, pageAccess } from "@/lib/cms/page-access";
import { cacheTags } from "@/lib/cms/sdk";
import { getFamilyGraph, getPhotos, getStories } from "@/lib/content/queries";
import { uploadPicture } from "@/lib/photos/upload";

// The Children slots on a person's page (edit mode): the editor fills in the other parent (name, status, photo)
// and the children (name + photo) right on the page, and this saves them to the person's "Children on this page"
// list (`families`). A new child gets their own Family Members entry (Parent = this person), so they also get a
// page and a frame on the Family Tree. Allowed on the pages the editor may change (their own and their children's).
//
// multipart POST, always with `path` (/family/<slug>) and `op`:
//   block-new    role, name, status, parentPhoto?, childName?, childPhoto?  -> a new block (other parent + first child)
//   parent       block, role?, name?, status?                               -> change the other parent's words
//   parent-photo block, file | remove=1                                     -> the other parent's photo
//   child-add    block, childName, childPhoto?                              -> a new child at the end of the block
//   child-photo  child, file | remove=1                                     -> the child's photo on THIS page
//   child-name   child, childName                                           -> the child's full name (their entry)
//   child-remove child                     -> off this page; their entry is deleted only if it holds nothing else
//   block-remove block                     -> a block with no children left

export const runtime = "nodejs";
export const maxDuration = 60;

const MEMBER_TYPE = "familyMember";
const ROLES = new Set(["Father", "Mother", "Spouse", "Partner"]);
/** what this tool writes on a new child's entry: an entry holding only these (+ system fields) may be deleted again */
const STARTER_FIELDS = new Set(["title", "slug", "parent", "lineage", "generation", "portrait", "treePhoto"]);

type Raw = Record<string, unknown>;
/** a picture as saved in an entry. `url` is kept with it: the site shows a picture inside a list from that url
 *  when the asset isn't used anywhere else (lib/content/image.ts resolveImage) */
type Pic = { _type: "asset"; _ref: string; alt: string; url?: string };
type RawKid = Raw & { _key?: string; child?: { _ref?: string }; photo?: Raw };
type RawBlock = Raw & { _key?: string; role?: string; name?: string; status?: string; photo?: Raw; children?: RawKid[] };

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const newKey = () => Math.random().toString(36).slice(2, 10);
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const refOf = (v: unknown) => (v && typeof v === "object" ? (v as { _ref?: unknown })._ref : undefined);

/** "Dakota Couch" -> "dakota-couch" */
const slugify = (name: string) =>
  name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** one entry as Snackbox has it now: the entry, null when there is none, undefined when Snackbox didn't answer */
async function readDoc(editor: EditorWrite, id: string): Promise<Raw | null | undefined> {
  const res = await fetch(`${editor.api}/doc/${encodeURIComponent(id)}`, { headers: editor.auth, cache: "no-store" }).catch(() => null);
  if (res?.status === 404) return null;
  if (!res?.ok) return undefined;
  const json = (await res.json().catch(() => null)) as { result?: Raw | null } | null;
  return json ? (json.result ?? null) : undefined;
}

async function mutate(editor: EditorWrite, mutations: unknown[], tool: string, published = false) {
  const res = await fetch(`${editor.api}/mutate`, {
    method: "POST",
    headers: { ...editor.auth, "Content-Type": "application/json" },
    body: JSON.stringify({ mutations, actor: actorFor(editor, tool), ...(published ? { perspective: "published" } : {}) }),
    cache: "no-store",
  }).catch(() => null);
  if (res?.ok) return null;
  const detail = res ? await res.text().catch(() => "") : "";
  return `Snackbox did not save it (${res?.status ?? "no answer"}). ${detail.slice(0, 160)}`.trim();
}

export async function POST(req: NextRequest) {
  const editor = await requireEditor("children");
  if (editor instanceof NextResponse) return editor;
  const form = await req.formData().catch(() => null);
  if (!form) return fail("Nothing was received.", 400);
  const path = clean(form.get("path"), 100);
  const slug = /^\/family\/([a-z0-9-]{1,80})$/.exec(path)?.[1];
  if (!slug) return fail("Children can only be added on a person's page.", 400);

  try {
    const access = await pageAccess(editor.email);
    if (!mayChange(access, path)) return fail(notYours(access), 403);
  } catch (err) {
    return fail(`Could not check which page is yours: ${(err as Error).message}`, 502);
  }

  const graph = await getFamilyGraph();
  const person = graph.bySlug.get(slug);
  if (!person) return fail("Couldn't find this person in Snackbox.", 404);
  const doc = await readDoc(editor, person._id);
  if (!doc) return fail("Couldn't read this person's entry in Snackbox. Try again.", 502);

  const families: RawBlock[] = Array.isArray(doc.families) ? (structuredClone(doc.families) as RawBlock[]) : [];
  const op = clean(form.get("op"), 20);
  const blockKey = clean(form.get("block"), 60);
  const childId = clean(form.get("child"), 80);
  const file = (name: string) => {
    const f = form.get(name);
    return f instanceof File && f.size ? f : undefined;
  };
  const tool = "Children";
  const who = person.title;

  const findBlock = () => families.find((b) => b._key === blockKey);
  const findKid = () => {
    for (const block of families) {
      const kid = (block.children ?? []).find((k) => refOf(k.child) === childId);
      if (kid) return { block, kid };
    }
    return undefined;
  };
  const picture = async (f: File, alt: string): Promise<Pic | NextResponse> => {
    const up = await uploadPicture(editor, f, alt);
    return up.ok ? { _type: "asset", _ref: up.id, alt, ...(up.url ? { url: up.url } : {}) } : fail(up.error, up.status);
  };
  /** the words on a block: the fields sent are set, sent empty are removed, not sent are kept */
  const setWords = (block: RawBlock) => {
    if (form.has("role")) {
      const role = clean(form.get("role"), 20);
      if (role && !ROLES.has(role)) return "Pick Father, Mother, Spouse or Partner.";
      if (role) block.role = role;
      else delete block.role;
    }
    for (const field of ["name", "status"] as const) {
      if (!form.has(field)) continue;
      const v = clean(form.get(field), 120);
      if (v) block[field] = v;
      else delete block[field];
    }
    return "";
  };

  /** a new child entry under this person, with a free page address */
  const newChild = async (name: string, pic?: Pic): Promise<{ id: string; create: unknown } | NextResponse> => {
    const base = slugify(name) || "child";
    const candidates = [base, `${base}-${person.slug}`, ...Array.from({ length: 8 }, (_, i) => `${base}-${i + 2}`)];
    for (const s of candidates) {
      if (s.length > 80 || graph.bySlug.has(s)) continue;
      const taken = await readDoc(editor, `member-${s}`);
      if (taken === undefined) return fail("Snackbox didn't answer. Try again.", 502);
      if (taken) continue;
      const data: Raw = { title: name, slug: s, parent: { _ref: person._id } };
      const lineage = refOf(doc.lineage) ?? (person.depth === 1 ? person._id : undefined);
      if (lineage) data.lineage = { _ref: lineage };
      data.generation = (typeof doc.generation === "number" ? doc.generation : person.generation) + 1;
      if (pic) data.portrait = pic;
      return { id: `member-${s}`, create: { create: { type: MEMBER_TYPE, id: `member-${s}`, data } } };
    }
    return fail(`There are already several pages called "${name}". Ask the site owner to add this child.`, 409);
  };

  /** creates the child (published), then saves the list; answers the error text, or "" */
  const saveWithChild = async (child: { id: string; create: unknown }, detail: string) => {
    const created = await mutate(editor, [child.create], tool, true);
    if (created) return created;
    await mutate(editor, [{ publish: { id: child.id } }], tool, true); // harmless if the create already published it
    return saveList(detail, [child.id]);
  };
  const saveList = (detail: string, extra: string[] = []) =>
    mutate(editor, [{ patch: { id: person._id, set: { families } } }, logMutation(editor, { tool, page: path, entries: [person._id, ...extra], detail })], tool);

  let error: string | null = "";
  let answer: Raw = {};

  if (op === "block-new") {
    const block: RawBlock = { _key: `fam-${newKey()}`, children: [] };
    const bad = setWords(block);
    if (bad) return fail(bad, 400);
    const parentPhoto = file("parentPhoto");
    if (parentPhoto) {
      const pic = await picture(parentPhoto, block.name ?? "");
      if (pic instanceof NextResponse) return pic;
      block.photo = pic;
    }
    const childName = clean(form.get("childName"), 120);
    if (!childName && !block.name && !block.photo && !block.role) return fail("Type a name or add a photo first.", 400);
    families.push(block);
    answer = { block: block._key };
    if (childName) {
      const childPhoto = file("childPhoto");
      const pic = childPhoto ? await picture(childPhoto, childName) : undefined;
      if (pic instanceof NextResponse) return pic;
      const child = await newChild(childName, pic);
      if (child instanceof NextResponse) return child;
      block.children!.push({ _key: newKey(), child: { _ref: child.id }, ...(pic ? { photo: pic } : {}) });
      error = await saveWithChild(child, `Added ${childName} under ${who}${block.name ? ` (with ${block.name})` : ""}`);
      answer.child = child.id;
    } else error = await saveList(`Added ${block.name ?? "another parent"} to ${who}'s Children`);
  } else if (op === "parent" || op === "parent-photo" || op === "block-remove") {
    const block = findBlock();
    if (!block) return fail("This part of the page changed. Reload the page and try again.", 409);
    if (op === "parent") {
      const bad = setWords(block);
      if (bad) return fail(bad, 400);
      error = await saveList(`Changed the other parent on ${who}'s page to ${[block.role, block.name, block.status].filter(Boolean).join(" · ") || "(nothing)"}`);
    } else if (op === "parent-photo") {
      const f = file("file");
      if (form.get("remove") === "1") delete block.photo;
      else if (f) {
        const pic = await picture(f, block.name ?? "");
        if (pic instanceof NextResponse) return pic;
        block.photo = pic;
      } else return fail("No picture was received.", 400);
      error = await saveList(`${block.photo ? "New" : "Removed the"} photo of ${block.name ?? "the other parent"} on ${who}'s page`);
    } else {
      if (block.children?.length) return fail("Take the children out of this group first.", 400);
      families.splice(families.indexOf(block), 1);
      error = await saveList(`Removed ${block.name ?? "an empty group"} from ${who}'s Children`);
    }
  } else if (op === "child-add") {
    const block = findBlock();
    if (!block) return fail("This part of the page changed. Reload the page and try again.", 409);
    const childName = clean(form.get("childName"), 120);
    if (!childName) return fail("Type the child's name first.", 400);
    const childPhoto = file("childPhoto");
    const pic = childPhoto ? await picture(childPhoto, childName) : undefined;
    if (pic instanceof NextResponse) return pic;
    const child = await newChild(childName, pic);
    if (child instanceof NextResponse) return child;
    (block.children ??= []).push({ _key: newKey(), child: { _ref: child.id }, ...(pic ? { photo: pic } : {}) });
    error = await saveWithChild(child, `Added ${childName} under ${who}`);
    answer = { child: child.id };
  } else if (op === "child-photo" || op === "child-name" || op === "child-remove") {
    const found = findKid();
    const node = graph.byId.get(childId);
    if (!found) return fail("This child isn't on this page's list. Reload the page and try again.", 409);
    if (op === "child-photo") {
      const f = file("file");
      if (form.get("remove") === "1") delete found.kid.photo;
      else if (f) {
        const pic = await picture(f, node?.title ?? "");
        if (pic instanceof NextResponse) return pic;
        found.kid.photo = pic;
      } else return fail("No picture was received.", 400);
      error = await saveList(`${found.kid.photo ? "New" : "Removed the"} photo of ${node?.title ?? childId} on ${who}'s page`, [childId]);
    } else if (op === "child-name") {
      const childName = clean(form.get("childName"), 120);
      if (!childName) return fail("Type the child's name first.", 400);
      error = await mutate(editor, [
        { patch: { id: childId, set: { title: childName } } },
        logMutation(editor, { tool, page: path, entries: [childId], detail: `Renamed ${node?.title ?? childId} to ${childName} (on ${who}'s page)` }),
      ], tool);
    } else {
      // only a child added here by mistake goes away completely: added with these slots on this page (Edit log),
      // and nothing else on their entry yet - no other fields, children, photos or stories
      if (!(await childrenAddedOn(editor, path)).has(childId)) {
        return fail(`${node?.title ?? "This child"} wasn't added with these slots, so they can't be removed here. Ask the site owner.`, 400);
      }
      const raw = await readDoc(editor, childId);
      if (raw === undefined) return fail("Snackbox didn't answer. Try again.", 502);
      const [photos, stories] = await Promise.all([getPhotos(), getStories()]);
      const extra = raw ? Object.keys(raw).filter((k) => !k.startsWith("_") && !STARTER_FIELDS.has(k)) : [];
      const inUse =
        extra.length > 0 ||
        refOf(raw?.parent) !== person._id ||
        graph.all.some((m) => m.parentId === childId) ||
        photos.some((p) => p.peopleIds?.includes(childId)) ||
        stories.some((s) => s.authorId === childId || s.peopleIds?.includes(childId));
      if (inUse) return fail(`${node?.title ?? "This child"} already has their own page content, so they can't be removed here. Ask the site owner.`, 400);
      found.block.children = (found.block.children ?? []).filter((k) => k !== found.kid);
      error = await saveList(`Removed ${node?.title ?? childId} from ${who}'s Children (entry deleted)`, [childId]);
      if (!error && raw) {
        const gone = await mutate(editor, [{ delete: { id: childId } }], tool, true);
        if (gone) error = `Taken off this page, but the child's own entry is still in Snackbox: ${gone}`;
      }
    }
  } else return fail("Unknown change.", 400);

  if (error) return fail(error, 502);
  revalidateTag(cacheTags.type(editor.project, MEMBER_TYPE), { expire: 0 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, ...answer });
}
