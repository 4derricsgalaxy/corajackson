// Which pages a signed-in editor may change with the on-page tools (Design tool).
// Snackbox owners and team members: every page. A "Family member": only their own /family/<slug> page,
// found by the email their invite was linked to (the member entry's private `email` field).
// The public read API never returns that field, so this asks Snackbox's admin (MCP) endpoint with the
// site's write token. Answers are kept for a few minutes per email.

type Access = { all: true } | { all: false; pages: string[] };

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
  if (!email) return { all: false, pages: [] };
  const hit = cache.get(email);
  if (hit && Date.now() - hit.at < TTL) return hit.access;

  const members = await mcp<{ email?: string; role?: string }[]>("list_project_members", {});
  const role = members.find((m) => m.email?.toLowerCase() === email)?.role;
  let access: Access;
  if (role && FULL_ROLES.has(role)) access = { all: true };
  else {
    const filter = { type: "familyMember", filters: [{ op: "eq", path: "email", value: email }], limit: 10 };
    const found = await mcp<{ items?: { slug?: string; email?: string }[] }>("query", { fluent: JSON.stringify(filter) });
    const pages = (found.items ?? []).filter((m) => m.slug && m.email?.toLowerCase() === email).map((m) => `/family/${m.slug}`);
    access = { all: false, pages };
  }
  cache.set(email, { at: Date.now(), access });
  return access;
}

export const mayChange = (access: Access, path: string) => access.all || access.pages.includes(path);
