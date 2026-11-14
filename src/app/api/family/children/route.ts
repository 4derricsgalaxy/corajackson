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
//   child-move   child, block (a block key, or "new")                    -> under another parent's group (or a new one)
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
type Pic = { _type: "asset"; _ref: string; alt: string; url?: string; width?: number; height?: number };
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
  if (res) console.warn("[children] Snackbox refused a change:", res.status, (await res.text().catch(() => "")).slice(0, 300));
  return res ? `Snackbox did not save it (it answered ${res.status}). Try again in a moment.` : "Snackbox didn't answer. Try again in a moment.";
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
    const access = await pageAccess(editor.email, (a) => mayChange(a, path));
    if (!mayChange(access, path)) return fail(notYours(access), 403);
  } catch (err) {
    return fail(`Could not check which page is yours: ${(err as Error).message}`, 502);
  }

  const graph = await getFamilyGraph();
  const person = graph.bySlug.get(slug);
  if (!person) return fail("Couldn't find this person in Snackbox.", 404);
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
    // (its size too, so a crop set on it later can be shown)
    return up.ok ? { _type: "asset", _ref: up.id, alt, ...(up.url ? { url: up.url } : {}), ...(up.width && up.height ? { width: up.width, height: up.height } : {}) } : fail(up.error, up.status);
  };
  // Pictures go up FIRST; only then is the entry read, changed and saved, all within a moment - so two saves on this
  // page (a slow photo upload and another change) can't read the same list and wipe out each other's change.
  const pics: Record<string, Pic | undefined> = {};
  const upload = async (field: string, alt: string) => {
    const f = file(field);
    if (!f) return undefined;
    const pic = await picture(f, alt);
    if (pic instanceof NextResponse) return pic;
    pics[field] = pic;
    return undefined;
  };
  {
    const childName = clean(form.get("childName"), 120);
    const removing = form.get("remove") === "1";
    const refused =
      op === "block-new" ? (await upload("parentPhoto", clean(form.get("name"), 120))) ?? (childName ? await upload("childPhoto", childName) : undefined)
      : op === "child-add" ? (childName ? await upload("childPhoto", childName) : undefined)
      : op === "parent-photo" && !removing ? await upload("file", "")
      : op === "child-photo" && !removing ? await upload("file", graph.byId.get(childId)?.title ?? "")
      : undefined;
    if (refused) return refused;
  }

  const doc = await readDoc(editor, person._id);
  if (!doc) return fail("Couldn't read this person's entry in Snackbox. Try again.", 502);
  const families: RawBlock[] = Array.isArray(doc.families) ? (structuredClone(doc.families) as RawBlock[]) : [];

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

  /** a new child entry under this person, with a free page address. A child of THIS person with the same name already
   *  in Snackbox (a save that created the entry but then failed, tried again) is used again instead (`create` null). */
  const newChild = async (name: string, pic?: Pic): Promise<{ id: string; create: unknown } | NextResponse> => {
    const base = slugify(name) || "child";
    const candidates = [base, `${base}-${person.slug}`, ...Array.from({ length: 8 }, (_, i) => `${base}-${i + 2}`)];
    const same = (title: unknown) => typeof title === "string" && slugify(title) === slugify(name);
    for (const s of candidates) {
      if (s.length > 80) continue;
      const known = graph.bySlug.get(s);
      if (known) {
        if (known.parentId === person._id && same(known.title)) return { id: known._id, create: null };
        continue;
      }
      const taken = await readDoc(editor, `member-${s}`);
      if (taken === undefined) return fail("Snackbox didn't answer. Try again.", 502);
      if (taken && refOf(taken.parent) === person._id && same(taken.title)) return { id: `member-${s}`, create: null };
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
    if (child.create) {
      const created = await mutate(editor, [child.create], tool, true);
      if (created) return created;
      await mutate(editor, [{ publish: { id: child.id } }], tool, true); // harmless if the create already published it
    }
    return saveList(detail, [child.id]);
  };
  /** the block a child is already listed in on this page */
  const listedIn = (id: string) => families.find((b) => (b.children ?? []).some((k) => refOf(k.child) === id));
  const saveList = (detail: string, extra: string[] = []) =>
    mutate(editor, [{ patch: { id: person._id, set: { families } } }, logMutation(editor, { tool, page: path, entries: [person._id, ...extra], detail })], tool);

  let error: string | null = "";
  let answer: Raw = {};

  if (op === "block-new") {
    const block: RawBlock = { _key: `fam-${newKey()}`, children: [] };
    const bad = setWords(block);
    if (bad) return fail(bad, 400);
    if (pics.parentPhoto) block.photo = pics.parentPhoto;
    const childName = clean(form.get("childName"), 120);
    if (!childName && !block.name && !block.photo && !block.role) return fail("Type a name or add a photo first.", 400);
    if (childName) {
      const pic = pics.childPhoto;
      const child = await newChild(childName, pic);
      if (child instanceof NextResponse) return child;
      const already = listedIn(child.id);
      if (already) return NextResponse.json({ ok: true, block: already._key, child: child.id }); // saved already (a second tap, or a retry)
      families.push(block);
      block.children!.push({ _key: newKey(), child: { _ref: child.id }, ...(pic ? { photo: pic } : {}) });
      error = await saveWithChild(child, `Added ${childName} under ${who}${block.name ? ` (with ${block.name})` : ""}`);
      answer = { block: block._key, child: child.id };
    } else {
      // the same other parent with no children yet is already there: a second tap, or a retry after a lost answer
      const twin = block.name && families.find((b) => !(b.children ?? []).length && b.name === block.name && (b.role ?? "") === (block.role ?? ""));
      if (twin) return NextResponse.json({ ok: true, block: twin._key });
      families.push(block);
      answer = { block: block._key };
      error = await saveList(`Added ${block.name ?? "another parent"} to ${who}'s Children`);
    }
  } else if (op === "parent" || op === "parent-photo" || op === "block-remove") {
    const block = findBlock();
    if (!block) return fail("This part of the page changed. Reload the page and try again.", 409);
    if (op === "parent") {
      const bad = setWords(block);
      if (bad) return fail(bad, 400);
      error = await saveList(`Changed the other parent on ${who}'s page to ${[block.role, block.name, block.status].filter(Boolean).join(" · ") || "(nothing)"}`);
    } else if (op === "parent-photo") {
      if (form.get("remove") === "1") delete block.photo;
      else if (pics.file) block.photo = { ...pics.file, alt: block.name ?? "" };
      else return fail("No picture was received.", 400);
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
    const pic = pics.childPhoto;
    const child = await newChild(childName, pic);
    if (child instanceof NextResponse) return child;
    if (listedIn(child.id)) return NextResponse.json({ ok: true, child: child.id }); // saved already (a second tap, or a retry)
    (block.children ??= []).push({ _key: newKey(), child: { _ref: child.id }, ...(pic ? { photo: pic } : {}) });
    error = await saveWithChild(child, `Added ${childName} under ${who}`);
    answer = { child: child.id };
  } else if (op === "child-move") {
    const found = findKid();
    if (!found) return fail("This child isn't on this page's list. Reload the page and try again.", 409);
    const node = graph.byId.get(childId);
    let target = blockKey === "new" ? undefined : findBlock();
    if (blockKey !== "new" && !target) return fail("This part of the page changed. Reload the page and try again.", 409);
    if (target === found.block) return fail("They are already in that group.", 400);
    found.block.children = (found.block.children ?? []).filter((k) => k !== found.kid);
    if (!target) {
      // a new group, placed right after the one they came from
      target = { _key: `fam-${newKey()}`, children: [] };
      families.splice(families.indexOf(found.block) + 1, 0, target);
    }
    (target.children ??= []).push(found.kid);
    // the group they left: gone when it is now empty and says nothing (no other parent named, no photo)
    const left = found.block;
    if (!left.children?.length && !left.name && !left.role && !left.status && !left.photo) families.splice(families.indexOf(left), 1);
    const to = target.name ? `${target.role ? `${target.role} ` : ""}${target.name}` : blockKey === "new" ? "a new group" : "another group";
    error = await saveList(`Moved ${node?.title ?? childId} to ${to} on ${who}'s page`, [childId]);
    answer = { block: target._key };
  } else if (op === "child-photo" || op === "child-name" || op === "child-remove") {
    const found = findKid();
    const node = graph.byId.get(childId);
    if (!found) return fail("This child isn't on this page's list. Reload the page and try again.", 409);
    if (op === "child-photo") {
      if (form.get("remove") === "1") delete found.kid.photo;
      else if (pics.file) found.kid.photo = pics.file;
      else return fail("No picture was received.", 400);
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
      if (raw) {
        // (raw null: an earlier try already deleted the entry; only the list is left to fix)
        const [photos, stories] = await Promise.all([getPhotos(), getStories()]);
        const extra = Object.keys(raw).filter((k) => !k.startsWith("_") && !STARTER_FIELDS.has(k));
        const inUse =
          extra.length > 0 ||
          refOf(raw.parent) !== person._id ||
          graph.all.some((m) => m.parentId === childId) ||
          photos.some((p) => p.peopleIds?.includes(childId)) ||
          stories.some((s) => s.authorId === childId || s.peopleIds?.includes(childId));
        if (inUse) return fail(`${node?.title ?? "This child"} already has their own page content, so they can't be removed here. Ask the site owner.`, 400);
        // the entry first: if this fails nothing has changed; if the list save below fails, the page just shows one child fewer
        const gone = await mutate(editor, [{ delete: { id: childId } }], tool, true);
        if (gone) return fail(gone, 502);
      }
      found.block.children = (found.block.children ?? []).filter((k) => k !== found.kid);
      error = await saveList(`Removed ${node?.title ?? childId} from ${who}'s Children (entry deleted)`, [childId]);
    }
  } else return fail("Unknown change.", 400);

  if (error) return fail(error, 502);
  revalidateTag(cacheTags.type(editor.project, MEMBER_TYPE), { expire: 0 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, ...answer });
}
