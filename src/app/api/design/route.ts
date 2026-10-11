import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireEditor, type EditorWrite } from "@/lib/cms/editor-auth";
import { cacheTags } from "@/lib/cms/sdk";
import { cleanDesign, designDocId, isEmptyDesign, parseDesign, PATH_RE, type Design } from "@/lib/design/model";
import { DESIGN_TYPE } from "@/lib/design/server";

// The Design tool's save endpoint. Only a signed-in editor (requireEditor) can use it.
//   GET  ?path=/family/carlos        -> { design, history: [{ at, design }] }  (earlier saved versions)
//   POST { path, design }             -> saves that page's design (design: null = back to the default format)
//   POST { copyTo: [paths], design }  -> gives each of those pages this design
// Each save keeps the page's previous design in `history` (newest first), so it can be brought back.

const KEEP = 10;
type Version = { at: string; data: string };
type Doc = { result?: { data?: string; history?: string } };

async function readDoc(editor: EditorWrite, id: string) {
  const res = await fetch(`${editor.api}/doc/${encodeURIComponent(id)}`, { headers: editor.auth, cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not read the saved design (${res.status}).`);
  return ((await res.json()) as Doc).result ?? null;
}

function parseHistory(v: unknown): Version[] {
  if (typeof v !== "string" || !v) return [];
  try {
    const list = JSON.parse(v) as unknown;
    return Array.isArray(list) ? list.filter((x): x is Version => typeof x?.at === "string" && typeof x?.data === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const editor = await requireEditor("designs");
  if (editor instanceof NextResponse) return editor;
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!PATH_RE.test(path)) return NextResponse.json({ error: "Bad page address." }, { status: 400 });
  try {
    const doc = await readDoc(editor, designDocId(path));
    const history = parseHistory(doc?.history).map((v) => ({ at: v.at, design: parseDesign(v.data) ?? null }));
    return NextResponse.json({ design: parseDesign(doc?.data) ?? null, history }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const editor = await requireEditor("designs");
  if (editor instanceof NextResponse) return editor;

  const body = (await req.json().catch(() => null)) as { path?: unknown; copyTo?: unknown; design?: unknown } | null;
  const paths = Array.isArray(body?.copyTo) ? body.copyTo : [body?.path];
  if (!paths.length || paths.length > 150 || !paths.every((p): p is string => typeof p === "string" && PATH_RE.test(p))) {
    return NextResponse.json({ error: "Bad page address." }, { status: 400 });
  }
  const design: Design | null = body?.design === null ? null : cleanDesign(body?.design);
  const baseData = design && !isEmptyDesign(design) ? JSON.stringify(design) : "";

  const mutations = [];
  try {
    for (const path of new Set(paths)) {
      const id = designDocId(path);
      const doc = await readDoc(editor, id);
      // a person's page keeps its one background on the Snackbox entry (Page background), never in the design
      let data = baseData;
      if (design && /^\/family\/[^/]+$/.test(path) && design.page.image) {
        const page = { ...design.page };
        delete page.image; delete page.imageFit; delete page.imageOpacity;
        const d = { ...design, page };
        data = isEmptyDesign(d) ? "" : JSON.stringify(d);
      }
      const history = parseHistory(doc?.history);
      if (doc?.data && doc.data !== data) history.unshift({ at: new Date().toISOString(), data: doc.data });
      const fields = { title: path, data, history: JSON.stringify(history.slice(0, KEEP)) };
      mutations.push(doc ? { patch: { id, set: fields } } : { create: { type: DESIGN_TYPE, id, data: fields } });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  const res = await fetch(`${editor.api}/mutate`, {
    method: "POST",
    headers: { ...editor.auth, "Content-Type": "application/json" },
    body: JSON.stringify({ mutations, actor: "Design tool" }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json({ error: `Snackbox did not accept the change (${res.status}). ${detail.slice(0, 200)}` }, { status: 502 });
  }
  revalidateTag(cacheTags.type(editor.project, DESIGN_TYPE), { expire: 0 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, saved: mutations.length, design: baseData ? JSON.parse(baseData) : null });
}
