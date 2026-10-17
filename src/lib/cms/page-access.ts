import { NextResponse } from "next/server";
import { getFamilyGraph } from "@/lib/content/queries";
import { requireEditor, type EditorWrite } from "./editor-auth";

// Which pages a signed-in editor may change with the on-page tools (Design, Crop, Add photos).
// Snackbox owners and team members: every page. A "Family member": their own /family/<slug> page and their
// children's pages. Their own entry is found by the email their invite was linked to (the member entry's
// private `email` field); their children are the entries whose Parent is them. (The Snackbox "Family member"
// role grants the same: own entry + entries whose `parent` is them.)
// The public read API never returns that field, so this asks Snackbox's admin (MCP) endpoint with the
// site's write token. Answers are kept for a few minutes per email.

/** pages: page addresses; ids: the Family Members entries behind them (own first) */
export type Access = { all: true } | { all: false; pages: string[]; ids: string[] };

const TTL = 5 * 60_000;
const cache = new Map<string, { at: number; access: Access }>();
const FULL_ROLES = new Set(["owner", "team"]);

async function mcp<T>(tool: string, args: Record<string, unknown>): Promise<T> {
  const cms = (process.env.NEXT_PUBLIC_SNACKBOX_URL ?? "").replace(/\/$/, "");
  const token = process.env.SNACKBOX_WRITE_TOKEN ?? "";
  if (!cms || !token) throw new Error("Snackbox is not set up on this site.");
  const url = `${cms}/api/mcp`;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  const send = async (body: object) => {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const sid = res.headers.get("mcp-session-id");
    if (sid) headers["Mcp-Session-Id"] = sid;
    const text = await res.text();
    if (!res.ok) throw new Error(`Snackbox answered ${res.status}.`);
    // plain JSON, or a server-sent-events stream with the JSON on `data:` lines
    const json = text.trimStart().startsWith("{") ? text : text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5)).join("\n");
    return json.trim() ? (JSON.parse(json) as { result?: { content?: { text?: string }[]; isError?: boolean }; error?: { message?: string } }) : null;
  };
  await send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "corajackson-site", version: "1" } } });
  await send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
  const out = await send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: tool, arguments: args } });
  const text = out?.result?.content?.[0]?.text;
  if (!text || out?.result?.isError || out?.error) throw new Error(out?.error?.message ?? text ?? "No answer from Snackbox.");
  return JSON.parse(text) as T;
}

/** What this editor may change. Throws when Snackbox can't be asked (callers then refuse the change). */
export async function pageAccess(email: string | undefined): Promise<Access> {
  if (!email) return { all: false, pages: [], ids: [] };
  const hit = cache.get(email);
  if (hit && Date.now() - hit.at < TTL) return hit.access;

  const members = await mcp<{ email?: string; role?: string }[]>("list_project_members", {});
  const role = members.find((m) => m.email?.toLowerCase() === email)?.role;
  let access: Access;
  if (role && FULL_ROLES.has(role)) access = { all: true };
  else {
    const filter = { type: "familyMember", filters: [{ op: "eq", path: "email", value: email }], limit: 10 };
    const found = await mcp<{ items?: { _id?: string; slug?: string; email?: string }[] }>("query", { fluent: JSON.stringify(filter) });
    const own = (found.items ?? []).filter((m) => m._id && m.slug && m.email?.toLowerCase() === email);
    const graph = await getFamilyGraph();
    const people = own.flatMap((m) => [{ _id: m._id!, slug: m.slug! }, ...(graph.byId.get(m._id!)?.children ?? []).map((c) => ({ _id: c._id, slug: c.slug }))]);
    const ids = [...new Set(people.map((p) => p._id))];
    access = { all: false, ids, pages: [...new Set(people.map((p) => `/family/${p.slug}`))] };
  }
  cache.set(email, { at: Date.now(), access });
  return access;
}

export const mayChange = (access: Access, path: string) => access.all || access.pages.includes(path);
/** may change things that belong to this Family Members entry (its page, photos tagged with it, its album) */
export const mayChangeFor = (access: Access, memberId: string) => access.all || access.ids.includes(memberId);

/** For a page being rendered in edit mode: the signed-in editor, when they may change this page; else null. */
export async function editorForPage(path: string): Promise<EditorWrite | null> {
  const editor = await requireEditor("changes");
  if (editor instanceof NextResponse) return null;
  try {
    return mayChange(await pageAccess(editor.email), path) ? editor : null;
  } catch {
    return null;
  }
}

/** the refusal a family member gets for someone else's page */
export function notYours(access: Access) {
  if (access.all) return "";
  return access.pages.length
    ? `You can change only your own page and your children's pages (${access.pages.join(", ")}).`
    : "Your Snackbox sign-in is not linked to a page on this site yet. Ask the site owner to link it.";
}
