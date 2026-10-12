import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/cms/editor-auth";
import { actorFor, logMutation } from "@/lib/cms/edit-log";
import { mayChange, notYours, pageAccess } from "@/lib/cms/page-access";
import { getAssetIndex, getFamilyGraph } from "@/lib/content/queries";

// A person's page background lives on their Snackbox entry (Page background + Background strength), so the
// Design tool changes it here, straight away (not with the design's Save):
//   POST { path: "/family/keith", set: { asset?: "asset_…", src?: "https://…" } }  -> new background picture
//   POST { path, remove: true }                                                       -> no background
//   POST { path, strength: 0-100 | null }                                             -> how strong it shows
// Answers { ok, previous } — `previous` is the asset that was there, so the editor can put it back.

const ASSET_RE = /^asset_[A-Za-z0-9_-]{4,40}$/;

export async function POST(req: NextRequest) {
  const editor = await requireEditor("backgrounds");
  if (editor instanceof NextResponse) return editor;
  const body = (await req.json().catch(() => null)) as { path?: unknown; set?: { asset?: unknown; src?: unknown }; remove?: unknown; strength?: unknown } | null;
  const path = typeof body?.path === "string" ? body.path : "";
  const slug = /^\/family\/([a-z0-9-]{1,80})$/.exec(path)?.[1];
  if (!slug) return NextResponse.json({ error: "Only a person's page keeps its background in Snackbox." }, { status: 400 });

  try {
    const access = await pageAccess(editor.email);
    if (!mayChange(access, path)) return NextResponse.json({ error: notYours(access) }, { status: 403 });
  } catch (err) {
    return NextResponse.json({ error: `Could not check which page is yours: ${(err as Error).message}` }, { status: 502 });
  }

  const person = (await getFamilyGraph()).bySlug.get(slug);
  if (!person) return NextResponse.json({ error: "Couldn't find this person in Snackbox." }, { status: 404 });
  const doc = await fetch(`${editor.api}/doc/${encodeURIComponent(person._id)}`, { headers: editor.auth, cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ result?: { heroImage?: { _ref?: string } } }>) : null))
    .catch(() => null);
  if (!doc?.result) return NextResponse.json({ error: "Couldn't read this person's entry in Snackbox." }, { status: 502 });
  const previous = doc.result.heroImage?._ref;

  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  if (body?.remove === true) unset.push("heroImage");
  else if (body?.set) {
    let asset = typeof body.set.asset === "string" && ASSET_RE.test(body.set.asset) ? body.set.asset : undefined;
    if (!asset && typeof body.set.src === "string") {
      // a picture picked from the family's pictures: find its asset by address
      const src = body.set.src;
      for (const [id, img] of await getAssetIndex()) if (img.url === src || img.originalUrl === src) { asset = id; break; }
    }
    if (!asset) return NextResponse.json({ error: "That picture isn't in Snackbox yet. Upload it from your computer instead." }, { status: 400 });
    set.heroImage = { _type: "asset", _ref: asset, alt: "" };
  } else if (body && "strength" in body) {
    if (body.strength === null) unset.push("heroStrength");
    else if (typeof body.strength === "number" && Number.isFinite(body.strength)) set.heroStrength = Math.round(Math.min(100, Math.max(0, body.strength)));
    else return NextResponse.json({ error: "Bad strength." }, { status: 400 });
  } else return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const patch: Record<string, unknown> = { id: person._id };
  if (Object.keys(set).length) patch.set = set;
  if (unset.length) patch.unset = unset;
  const res = await fetch(`${editor.api}/mutate`, {
    method: "POST",
    headers: { ...editor.auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      mutations: [{ patch }, logMutation(editor, { tool: "Background", page: path, entries: [person._id], detail: body?.remove === true ? "Removed the page background" : set.heroImage ? `New page background (${(set.heroImage as { _ref: string })._ref})` : `Background strength ${set.heroStrength ?? "back to standard"}` })],
      actor: actorFor(editor, "Background"),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json({ error: `Snackbox did not accept the change (${res.status}). ${detail.slice(0, 200)}` }, { status: 502 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, previous });
}
