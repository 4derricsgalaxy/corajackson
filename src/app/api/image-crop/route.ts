import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/cms/editor-auth";
import { cleanCrop, CROP_FIELDS } from "@/lib/content/crop";
const DOC_RE = /^[A-Za-z0-9_.:-]{1,80}$/;

// Save endpoint for the on-page Crop tool. Only a signed-in editor (requireEditor) can write, and only the
// crop on one single-image field of the entry it names. Field "" = a Photos entry's own picture (`image`).

export async function POST(req: NextRequest) {
  const editor = await requireEditor("crops");
  if (editor instanceof NextResponse) return editor;
  const { api, auth } = editor;

  const body = (await req.json().catch(() => null)) as { doc?: unknown; field?: unknown; crop?: unknown } | null;
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
  const value = doc?.result?.[field];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return NextResponse.json({ error: "That entry has no picture in this spot to crop." }, { status: 404 });
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
    body: JSON.stringify({ mutations: [{ patch: { id: docId, set: { [field]: next } } }], actor: "Crop tool" }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json({ error: `Snackbox did not accept the change (${res.status}). ${detail.slice(0, 200)}` }, { status: 502 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
