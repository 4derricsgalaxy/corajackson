import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/cms/editor-auth";
import { cleanRow, DOC_RE, KEY_RE, parseTextLayout, type TextLayoutRow } from "@/lib/content/text-layout";

// Save endpoint for the on-page Layout tool. Only a signed-in editor (requireEditor) can write, and only
// the `textLayout` field of the entries it names.

const MAX_DOCS = 60;
const MAX_ROWS = 120;

type Change = { key: string; row: TextLayoutRow | null };

export async function POST(req: NextRequest) {
  // 1. editor check: draft mode on AND the overlay token still valid at the CMS
  const editor = await requireEditor("layouts");
  if (editor instanceof NextResponse) return editor;
  const { api, auth } = editor;

  // 2. validate the request: { changes: { [docId]: [{ key, row | null }] } }
  const body = (await req.json().catch(() => null)) as { changes?: Record<string, unknown> } | null;
  const entries = Object.entries(body?.changes ?? {});
  if (!entries.length || entries.length > MAX_DOCS) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const changes = new Map<string, Change[]>();
  for (const [docId, list] of entries) {
    if (!DOC_RE.test(docId) || !Array.isArray(list)) return NextResponse.json({ error: "Bad request." }, { status: 400 });
    const rows: Change[] = [];
    for (const c of list as { key?: unknown; row?: unknown }[]) {
      if (typeof c?.key !== "string" || !KEY_RE.test(c.key)) return NextResponse.json({ error: "Bad request." }, { status: 400 });
      const row = c.row ? cleanRow({ ...(c.row as object), key: c.key }) : undefined;
      rows.push({ key: c.key, row: row ?? null });
    }
    changes.set(docId, rows);
  }

  // 3. merge into each entry's current rows (other items' rows are kept) and write them all at once
  const mutations = [];
  for (const [docId, rows] of changes) {
    const doc = await fetch(`${api}/doc/${encodeURIComponent(docId)}`, { headers: auth, cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ result?: { textLayout?: unknown } }>) : null))
      .catch(() => null);
    if (!doc?.result) return NextResponse.json({ error: `Could not find the entry ${docId}.` }, { status: 404 });
    const merged = new Map((parseTextLayout(doc.result.textLayout) ?? []).map((r) => [r.key, r]));
    for (const { key, row } of rows) {
      if (row) merged.set(key, row);
      else merged.delete(key);
    }
    const list = [...merged.values()].slice(0, MAX_ROWS).map((r) => ({ _key: r.key, ...r }));
    mutations.push(list.length ? { patch: { id: docId, set: { textLayout: list } } } : { patch: { id: docId, unset: ["textLayout"] } });
  }
  const res = await fetch(`${api}/mutate`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ mutations, actor: "Layout tool" }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json({ error: `Snackbox did not accept the change (${res.status}). ${detail.slice(0, 200)}` }, { status: 502 });
  }

  // the CMS webhook revalidates too; this makes the saved look show on the next load either way
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, saved: mutations.length });
}
