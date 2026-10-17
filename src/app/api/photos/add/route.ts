import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/cms/editor-auth";
import { actorFor, fromPage, logMutation } from "@/lib/cms/edit-log";
import { mayChangeFor, notYours, pageAccess } from "@/lib/cms/page-access";
import { cacheTags } from "@/lib/cms/sdk";
import { MAX_PICTURE_BYTES, uploadPicture } from "@/lib/photos/upload";

// "Add photos" (drag-and-drop or the button) on a person's page or a Gallery album: one picture becomes one
// published Photos entry - tagged with that person (so it joins their Memories and their family's album), or
// filed in that family line's album. Only a signed-in editor can call this (requireEditor).
//
// The browser normally sends an upright JPEG it already converted (see lib/photos/prepare.ts). When a
// browser cannot read an iPhone HEIC photo it sends the original instead, and it is converted here.
//
// The browser also sends `key`: a fingerprint of the original file + the person/album. It becomes the entry's
// id, so the same photo added to the same page twice (picked again, or re-sent after a timeout) is found
// instead of saved a second time.

export const runtime = "nodejs";
export const maxDuration = 60;

const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const KEY_RE = /^[a-f0-9]{24}$/;
const PHOTO_TYPE = "photo";

type DocResult = { result?: Record<string, unknown> | null };

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  const editor = await requireEditor("photos");
  if (editor instanceof NextResponse) return editor;
  const { api, auth, project } = editor;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const person = form?.get("person");
  const line = form?.get("line");
  const targetId = typeof person === "string" && person ? person : typeof line === "string" && line ? line : "";
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "No picture was received." }, { status: 400 });
  if (!ID_RE.test(targetId)) return NextResponse.json({ error: "This page can't take photos." }, { status: 400 });
  if (file.size > MAX_PICTURE_BYTES) return NextResponse.json({ error: "That picture is too big (over 4 MB)." }, { status: 413 });

  // a family member adds photos to their own / their children's pages (or those family lines' albums)
  try {
    const access = await pageAccess(editor.email);
    if (!mayChangeFor(access, targetId)) return NextResponse.json({ error: notYours(access) }, { status: 403 });
  } catch (err) {
    return NextResponse.json({ error: `Could not check which page is yours: ${(err as Error).message}` }, { status: 502 });
  }

  // the person (or the family line's head) must be a real Family Members entry
  const target = await fetch(`${api}/doc/${encodeURIComponent(targetId)}`, { headers: auth, cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<DocResult>) : null))
    .catch(() => null);
  const targetTitle = clean(target?.result?.title, 120);
  if (!target?.result || !targetTitle) return NextResponse.json({ error: "Couldn't find this person in Snackbox." }, { status: 404 });

  // already added? (same fingerprint = same picture on the same page)
  const key = form?.get("key");
  const id = typeof key === "string" && KEY_RE.test(key) ? `photo-add-${key}` : `photo-add-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  if (typeof key === "string" && KEY_RE.test(key)) {
    const existing = await fetch(`${api}/doc/${encodeURIComponent(id)}`, { headers: auth, cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<DocResult>) : null))
      .catch(() => null);
    if (existing?.result) return NextResponse.json({ ok: true, already: true, id, title: clean(existing.result.title, 120), live: true });
  }

  const title = clean(form?.get("title"), 120) || `Photo of ${targetTitle}`;
  // picture -> JPEG/PNG/WebP the CMS accepts (HEIC converted there only when the browser couldn't)
  const asset = await uploadPicture(editor, file, title);
  if (!asset.ok) return NextResponse.json({ error: asset.error }, { status: asset.status });
  const assetId = asset.id;

  const data: Record<string, unknown> = { title, image: { _type: "asset", _ref: assetId, alt: title } };
  if (person) data.people = [{ _key: Math.random().toString(36).slice(2, 10), _ref: targetId }];
  else data.lineage = { _ref: targetId };

  const mutate = (mutations: unknown[]) =>
    fetch(`${api}/mutate`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ mutations, actor: actorFor(editor, "Add photos"), perspective: "published" }),
      cache: "no-store",
    }).catch(() => null);

  const created = await mutate([
    { create: { type: PHOTO_TYPE, id, data } },
    logMutation(editor, { tool: "Add photos", page: fromPage(req), entries: [id], detail: `Added "${title}" to ${person ? targetTitle : `${targetTitle}'s family album`}` }),
  ]);
  if (!created?.ok) {
    const detail = created ? await created.text().catch(() => "") : "";
    return NextResponse.json({ error: `Snackbox did not save the photo (${created?.status ?? "no answer"}). ${detail.slice(0, 160)}` }, { status: 502 });
  }
  // make sure it is published (harmless if the create already was)
  await mutate([{ publish: { id } }]);

  // is it really public? (the public read API only ever sees published entries)
  const cms = api.replace(/\/api\/v1\/[^/]+$/, "");
  const q = JSON.stringify({ type: PHOTO_TYPE, filters: [{ op: "eq", path: "_id", value: id }], limit: 1 });
  const live = await fetch(`${cms}/api/v1/${project}/query?q=${encodeURIComponent(q)}`, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ result?: unknown[] }>) : null))
    .then((j) => Boolean(j?.result?.length))
    .catch(() => false);

  revalidateTag(cacheTags.type(project, PHOTO_TYPE), { expire: 0 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, id, title, live, url: asset.url });
}
