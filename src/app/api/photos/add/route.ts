import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/cms/editor-auth";
import { cacheTags } from "@/lib/cms/sdk";

// "Add photos" (drag-and-drop or the button) on a person's page or a Gallery album: one picture becomes one
// published Photos entry - tagged with that person (so it joins their Memories and their family's album), or
// filed in that family line's album. Only a signed-in editor can call this (requireEditor).
//
// The browser normally sends an upright JPEG it already converted (see lib/photos/prepare.ts). When a
// browser cannot read an iPhone HEIC photo it sends the original instead, and it is converted here.

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4_400_000; // Vercel caps a request at 4.5 MB
const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const PHOTO_TYPE = "photo";

type DocResult = { result?: Record<string, unknown> | null };

const isHeic = (f: File) => /^image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);
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
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That picture is too big (over 4 MB)." }, { status: 413 });

  // the person (or the family line's head) must be a real Family Members entry
  const target = await fetch(`${api}/doc/${encodeURIComponent(targetId)}`, { headers: auth, cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<DocResult>) : null))
    .catch(() => null);
  const targetTitle = clean(target?.result?.title, 120);
  if (!target?.result || !targetTitle) return NextResponse.json({ error: "Couldn't find this person in Snackbox." }, { status: 404 });

  // picture -> JPEG/PNG/WebP the CMS accepts (HEIC converted here only when the browser couldn't)
  let upload: Blob = file;
  let uploadName = file.name || "photo.jpg";
  if (isHeic(file)) {
    try {
      const { default: convert } = await import("heic-convert");
      const jpeg = await convert({ buffer: new Uint8Array(await file.arrayBuffer()), format: "JPEG", quality: 0.88 });
      upload = new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" });
      uploadName = uploadName.replace(/\.hei[cf]$/i, "") + ".jpg";
    } catch {
      return NextResponse.json({ error: "Couldn't read this iPhone photo. Save it as a JPG and try again." }, { status: 422 });
    }
  } else if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG or iPhone (HEIC) photo." }, { status: 415 });
  }

  const title = clean(form?.get("title"), 120) || `Photo of ${targetTitle}`;
  const out = new FormData();
  out.set("file", upload, uploadName);
  out.set("alt", title);
  const asset = await fetch(`${api}/assets`, { method: "POST", headers: auth, body: out, cache: "no-store" })
    .then(async (r) => ({ ok: r.ok, status: r.status, json: (await r.json().catch(() => null)) as { result?: { id?: string; url?: string } } | null }))
    .catch(() => ({ ok: false, status: 0, json: null }));
  const assetId = asset.json?.result?.id;
  if (!asset.ok || !assetId) return NextResponse.json({ error: `Snackbox did not accept the picture (${asset.status || "no answer"}).` }, { status: 502 });

  const id = `photo-add-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const data: Record<string, unknown> = { title, image: { _type: "asset", _ref: assetId, alt: title } };
  if (person) data.people = [{ _key: Math.random().toString(36).slice(2, 10), _ref: targetId }];
  else data.lineage = { _ref: targetId };

  const mutate = (mutations: unknown[]) =>
    fetch(`${api}/mutate`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ mutations, actor: "Add photos", perspective: "published" }),
      cache: "no-store",
    }).catch(() => null);

  const created = await mutate([{ create: { type: PHOTO_TYPE, id, data } }]);
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
  return NextResponse.json({ ok: true, id, title, live, url: asset.json?.result?.url });
}
