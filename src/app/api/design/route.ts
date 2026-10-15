import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireEditor, type EditorWrite } from "@/lib/cms/editor-auth";
import { actorFor, logMutation } from "@/lib/cms/edit-log";
import { mayChange, notYours, pageAccess } from "@/lib/cms/page-access";
import { cacheTags } from "@/lib/cms/sdk";
import { canonicalDesign, cleanDesign, designDocId, isEmptyDesign, parseDesign, PATH_RE, storedDesign, type Design } from "@/lib/design/model";
import { DESIGN_TYPE } from "@/lib/design/server";

// The Design tool's save endpoint. Only a signed-in editor (requireEditor) can use it, and a Family member
// only for their own and their children's pages (pageAccess); owners and team members for every page.
//   GET  ?path=/family/carlos        -> { design, history: [{ at, design }] }  (earlier saved versions)
//   POST { path, design }             -> saves that page's design (design: null = back to the default format)
//   POST { copyTo: [paths], design }  -> gives each of those pages this design
// Each save keeps the page's previous design in `history` (newest first), so it can be brought back.
// A single-page save also sends `base` (the saved design the editor started from): if someone else saved the
// page since, the save is refused with `conflict: true` so nobody's work is overwritten without being asked
// (`force: true` saves anyway; the other version stays in `history`).

const KEEP = 10;
/** a page's design (without history) may be this big; the request limit on Vercel is 4.5 MB */
const MAX_DATA = 1_500_000;
/** earlier versions are dropped (oldest first) beyond this */
const MAX_HISTORY = 2_000_000;
type Version = { at: string; data: string };
type Doc = { result?: { data?: string; history?: string } };

/** null when this editor may change every one of these pages, else the refusal to send */
async function refuse(editor: EditorWrite, paths: string[]) {
  try {
    const access = await pageAccess(editor.email);
    if (paths.every((p) => mayChange(access, p))) return null;
    return NextResponse.json({ error: notYours(access) }, { status: 403 });
  } catch (err) {
    return NextResponse.json({ error: `Could not check which page is yours: ${(err as Error).message} Try again in a moment.` }, { status: 502 });
  }
}

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

/** "Marietha's save at 7:03 PM" — from the newest Edit log entry for this page, if it can be read */
async function lastSaveBy(editor: EditorWrite, path: string): Promise<string> {
  try {
    const q = { type: "editLog", filters: [{ op: "eq", path: "page", value: path }, { op: "eq", path: "tool", value: "Design" }], order: [{ path: "_order", dir: "asc" }], limit: 1 };
    const res = await fetch(`${editor.api}/query?q=${encodeURIComponent(JSON.stringify(q))}`, { headers: editor.auth, cache: "no-store" });
    const row = ((await res.json()) as { result?: { by?: string; at?: string }[] }).result?.[0];
    if (!row?.by || row.by === editor.email) return "";
    const time = row.at ? new Date(`${row.at}:00`).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
    return ` (${row.by}${time ? `, ${time}` : ""})`;
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const editor = await requireEditor("designs");
  if (editor instanceof NextResponse) return editor;
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!PATH_RE.test(path)) return NextResponse.json({ error: "Bad page address." }, { status: 400 });
  const no = await refuse(editor, [path]);
  if (no) return no;
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

  const body = (await req.json().catch(() => null)) as { path?: unknown; copyTo?: unknown; design?: unknown; base?: unknown; force?: unknown } | null;
  const paths = Array.isArray(body?.copyTo) ? body.copyTo : [body?.path];
  if (!paths.length || paths.length > 150 || !paths.every((p): p is string => typeof p === "string" && PATH_RE.test(p))) {
    return NextResponse.json({ error: "Bad page address." }, { status: 400 });
  }
  const no = await refuse(editor, [...new Set(paths)]);
  if (no) return no;
  const design: Design | null = body?.design === null ? null : cleanDesign(body?.design);
  const baseData = design && !isEmptyDesign(design) ? JSON.stringify(design) : "";
  if (baseData.length > MAX_DATA) {
    const mb = (baseData.length / 1e6).toFixed(1);
    return NextResponse.json({ error: `This page's design is too big to save (${mb} MB). Remove some copied pieces or pictures, then save again.` }, { status: 413 });
  }
  const single = !Array.isArray(body?.copyTo);
  const checkBase = single && body?.force !== true && body && "base" in body;

  const mutations = [];
  try {
    for (const path of new Set(paths)) {
      const id = designDocId(path);
      const doc = await readDoc(editor, id);
      if (checkBase) {
        const base = body.base === null ? "" : canonicalDesign(storedDesign(path, cleanDesign(body.base)));
        if (base !== canonicalDesign(doc?.data)) {
          const who = await lastSaveBy(editor, path);
          return NextResponse.json(
            { conflict: true, error: who ? `Someone else saved a change to this page after you opened the Design tool${who}.` : "This page was saved again after you opened the Design tool (by someone else, or by you in another window)." },
            { status: 409 },
          );
        }
      }
      const data = storedDesign(path, design);
      const history = parseHistory(doc?.history);
      if (doc?.data && doc.data !== data) history.unshift({ at: new Date().toISOString(), data: doc.data });
      let kept = history.slice(0, KEEP);
      while (kept.length > 1 && JSON.stringify(kept).length > MAX_HISTORY) kept = kept.slice(0, -1);
      const fields = { title: path, data, history: JSON.stringify(kept) };
      mutations.push(doc ? { patch: { id, set: fields } } : { create: { type: DESIGN_TYPE, id, data: fields } });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
  const pages = [...new Set(paths)];
  const what = design === null ? "Back to the default format" : Array.isArray(body?.copyTo) ? `Copied this design to ${pages.length} page(s)` : "Saved the page design";
  mutations.push(logMutation(editor, { tool: "Design", page: pages.length === 1 ? pages[0] : undefined, entries: pages.map(designDocId), detail: pages.length > 1 ? `${what}: ${pages.join(", ")}` : what }));

  const res = await fetch(`${editor.api}/mutate`, {
    method: "POST",
    headers: { ...editor.auth, "Content-Type": "application/json" },
    body: JSON.stringify({ mutations, actor: actorFor(editor, "Design") }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json({ error: `Snackbox did not accept the change (${res.status}). ${detail.slice(0, 200)}` }, { status: 502 });
  }
  revalidateTag(cacheTags.type(editor.project, DESIGN_TYPE), { expire: 0 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, saved: pages.length, design: baseData ? JSON.parse(baseData) : null });
}
