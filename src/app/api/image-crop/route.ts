import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/cms/editor-auth";
import { actorFor, fromPage, logMutation } from "@/lib/cms/edit-log";
import { mayChangeFor, notYours, pageAccess } from "@/lib/cms/page-access";
import { cleanCrop, CROP_FIELDS, LIST_CROP_FIELDS } from "@/lib/content/crop";
const DOC_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const ITEM_RE = /^(families|gallery):[A-Za-z0-9_.:-]{1,160}$/;

// Save endpoint for the on-page Crop tool. Only a signed-in editor (requireEditor) can write, and only the
// crop on one picture of the entry it names: a single-image field (field "" = a Photos entry's own picture,
// `image`), or one picture inside a list field, named by `item` (see LIST_CROP_FIELDS):
//   families:<block key>             the other parent's photo     families:<block key>:<child id>  a child's photo
//   gallery:<index>                  an Extra Memories photo (found by the picture itself; the index breaks ties)
// A picture inside a list also gets its size (`size`, from the browser): the site can't look it up there.

type Holder = Record<string | number, unknown>;

/** where the picture sits: the object (or list) holding it and its key there */
function locate(list: unknown[], item: string, src: string): { holder: Holder; key: string | number } | null {
  const [kind, a, b] = item.split(":");
  if (kind === "families") {
    const block = list.find((x) => (x as { _key?: unknown })?._key === a) as Holder | undefined;
    if (!block) return null;
    if (!b) return { holder: block, key: "photo" };
    const kids = Array.isArray(block.children) ? (block.children as Holder[]) : [];
    const kid = kids.find((k) => (k?.child as { _ref?: unknown } | undefined)?._ref === b);
    return kid ? { holder: kid, key: "photo" } : null;
  }
  const at = Number(a);
  const same = list.map((x, i) => ({ i, ref: (x as { _ref?: unknown })?._ref })).filter((x) => typeof x.ref === "string" && src.includes(`/${x.ref}`)).map((x) => x.i);
  const i = same.includes(at) ? at : same[0];
  return i === undefined ? null : { holder: list as unknown as Holder, key: i };
}

export async function POST(req: NextRequest) {
  const editor = await requireEditor("crops");
  if (editor instanceof NextResponse) return editor;
  const { api, auth } = editor;

  const body = (await req.json().catch(() => null)) as { doc?: unknown; field?: unknown; item?: unknown; crop?: unknown; src?: unknown; size?: { w?: unknown; h?: unknown } } | null;
  const docId = body?.doc;
  const field = body?.field === "" ? "image" : body?.field;
  const item = typeof body?.item === "string" && ITEM_RE.test(body.item) ? body.item : undefined;
  const listed = typeof field === "string" && LIST_CROP_FIELDS.includes(field);
  if (typeof docId !== "string" || !DOC_RE.test(docId) || typeof field !== "string" || !(CROP_FIELDS.includes(field) || (listed && item?.startsWith(`${field}:`)))) {
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
  // a single-image field holds the picture itself; a list field is copied and the picture found inside it
  const fieldValue = doc?.result?.[field];
  const list = listed && Array.isArray(fieldValue) ? (structuredClone(fieldValue) as unknown[]) : null;
  const spot = list && item ? locate(list, item, typeof body?.src === "string" ? body.src : "") : null;
  const value = listed ? spot?.holder[spot.key] : fieldValue;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return NextResponse.json({ error: listed ? "This picture was changed since the page opened. Reload the page, then crop again." : "That entry has no picture in this spot to crop." }, { status: listed ? 409 : 404 });
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
  const next: Record<string, unknown> = crop ? { ...rest, crop: { left: round(crop.left), top: round(crop.top), width: round(crop.width), height: round(crop.height) } } : rest;
  const w = Number(body?.size?.w), h = Number(body?.size?.h);
  if (listed && w > 0 && h > 0 && w < 50_000 && h < 50_000) Object.assign(next, { width: Math.round(w), height: Math.round(h) });
  if (spot) spot.holder[spot.key] = next;

  const res = await fetch(`${api}/mutate`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      mutations: [{ patch: { id: docId, set: { [field]: list ?? next } } }, logMutation(editor, { tool: "Crop", page: fromPage(req), entries: [docId], detail: `${crop ? "Cropped the picture" : "Removed the crop"} (${item ?? field})` })],
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
