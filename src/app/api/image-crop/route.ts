import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/cms/editor-auth";
import { actorFor, fromPage, logMutation } from "@/lib/cms/edit-log";
import { mayChangeFor, notYours, pageAccess } from "@/lib/cms/page-access";
import { cleanCrop, CROP_FIELDS } from "@/lib/content/crop";
const DOC_RE = /^[A-Za-z0-9_.:-]{1,80}$/;

// Save endpoint for the on-page Crop tool. Only a signed-in editor (requireEditor) can write, and only the
// crop on one single-image field of the entry it names. Field "" = a Photos entry's own picture (`image`).

export async function POST(req: NextRequest) {
  const editor = await requireEditor("crops");
  if (editor instanceof NextResponse) return editor;
  const { api, auth } = editor;

  const body = (await req.json().catch(() => null)) as { doc?: unknown; field?: unknown; crop?: unknown; src?: unknown } | null;
  const docId = body?.doc;
  const field = body?.field === "" ? "image" : body?.field;
  if (typeof docId !== "string" || !DOC_RE.test(docId) || typeof field !== "string" || !CROP_FIELDS.includes(field)) {
    return NextResponse.json({ error: "This picture can't be cropped here." }, { status: 400 });
  }
  const crop = body?.crop === null ? null : cleanCrop(body?.crop);
  if (crop === undefined) return NextResponse.json({ error: "Bad crop." }, { status: 400 });

  const doc = await fetch(`${api}/doc/${encodeURIComponent(docId)}`, { headers: auth, cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ result?: Record<string, unknown> }>) : null))
    .catch(() => null);
  // a family member: pictures on their own / their children's entries, or photos tagged with one of them
  try {
    const access = await pageAccess(editor.email);
    // (being tagged in it counts only for a Photos entry, not e.g. a Story that lists people)
    const tagged = doc?.result?._type === "photo" && Array.isArray(doc.result.people) ? (doc.result.people as { _ref?: string }[]).map((p) => p?._ref ?? "") : [];
    if (!access.all && !mayChangeFor(access, docId) && !tagged.some((id) => mayChangeFor(access, id))) {
      return NextResponse.json({ error: notYours(access) }, { status: 403 });
    }
  } catch (err) {
    return NextResponse.json({ error: `Could not check which page is yours: ${(err as Error).message}` }, { status: 502 });
  }
  const value = doc?.result?.[field];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return NextResponse.json({ error: "That entry has no picture in this spot to crop." }, { status: 404 });
  }

  // the crop was drawn on the picture the page showed: if someone has put a different picture in this spot
  // since, refuse rather than crop the new one with the old one's frame
  const ref = (value as { _ref?: unknown })._ref;
  if (typeof body?.src === "string" && typeof ref === "string" && /^asset_[A-Za-z0-9_-]+$/.test(ref) && !body.src.includes(`/${ref}`)) {
    return NextResponse.json({ error: "This picture was changed since the page opened. Reload the page, then crop again." }, { status: 409 });
  }

  // a new crop replaces any old crop and hotspot (the hotspot would re-center it); "remove" drops both
  const rest = { ...(value as Record<string, unknown>) };
  delete rest.crop;
  delete rest.hotspot;
  const round = (n: number) => Math.round(n * 10000) / 10000;
  const next = crop ? { ...rest, crop: { left: round(crop.left), top: round(crop.top), width: round(crop.width), height: round(crop.height) } } : rest;

  const res = await fetch(`${api}/mutate`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      mutations: [{ patch: { id: docId, set: { [field]: next } } }, logMutation(editor, { tool: "Crop", page: fromPage(req), entries: [docId], detail: crop ? `Cropped the picture (${field})` : `Removed the crop (${field})` })],
      actor: actorFor(editor, "Crop"),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json({ error: `Snackbox did not accept the change (${res.status}). ${detail.slice(0, 200)}` }, { status: 502 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
