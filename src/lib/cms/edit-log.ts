import type { NextRequest } from "next/server";
import type { EditorWrite } from "./editor-auth";

// Who changed what on the website. Every save made with the on-page tools (Design, Background, Crop, Add photos)
// goes to Snackbox under the site's own write key, so Snackbox alone can't tell who made it. Each of those saves
// therefore also creates one "Edit log" entry (collection `editLog`) in the SAME /mutate batch, so the change and
// its record are saved together or not at all.

export const EDIT_LOG_TYPE = "editLog";

type Entry = {
  /** Design, Background, Crop or Add photos */
  tool: string;
  /** the site page it was made on (falls back to the page the request came from) */
  page?: string;
  /** the Snackbox entries the change was saved to */
  entries: string[];
  detail?: string;
};

/** the site page the request came from, e.g. /family/anthony */
export function fromPage(req: NextRequest): string | undefined {
  const ref = req.headers.get("referer");
  if (!ref) return undefined;
  try {
    return new URL(ref).pathname.slice(0, 200);
  } catch {
    return undefined;
  }
}

/** "2026-10-12T14:05" in Pacific time */
function pacific(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Studio lists entries by `_order`: a rank that SHRINKS as time goes on, so the newest change is listed first.
 *  13 digits, fixed width, so it sorts the same as text or as a number (good until the year 2286). */
export const newestFirstRank = (ms: number) => "0" + String(1e13 - ms).padStart(13, "0");

/** the `create` mutation that records this change, to send in the same batch as the change itself */
export function logMutation(editor: EditorWrite, e: Entry) {
  const at = new Date();
  const by = editor.email ?? "unknown (no email on the edit session)";
  const wall = pacific(at); // Snackbox datetimes are wall times ("2026-10-12T14:05"): the family's own (Pacific) time
  const data: Record<string, string> = {
    title: [`${wall.replace("T", " ")} Pacific`, by, e.tool, e.page ?? e.entries[0] ?? ""].filter(Boolean).join(" · ").slice(0, 300),
    at: wall,
    by,
    tool: e.tool,
    entries: e.entries.join(", ").slice(0, 2000),
    _order: newestFirstRank(at.getTime()),
  };
  if (e.page) data.page = e.page;
  if (e.detail) data.detail = e.detail.slice(0, 1000);
  const id = `edit-${at.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return { create: { type: EDIT_LOG_TYPE, id, data } };
}

/** the `actor` Snackbox stores with a change: who made it, with which tool */
export const actorFor = (editor: EditorWrite, tool: string) => `${editor.email ?? "unknown"} (${tool}, website)`;

/** the children added with the Children slots on this page (from the Edit log): the only ones the slots may delete again */
export async function childrenAddedOn(editor: EditorWrite, page: string): Promise<Set<string>> {
  const q = { type: EDIT_LOG_TYPE, filters: [{ op: "eq", path: "tool", value: "Children" }, { op: "eq", path: "page", value: page }], limit: 200 };
  const res = await fetch(`${editor.api}/query?q=${encodeURIComponent(JSON.stringify(q))}`, { headers: editor.auth, cache: "no-store" }).catch(() => null);
  const json = res?.ok ? ((await res.json().catch(() => null)) as { result?: { detail?: string; entries?: string }[] } | null) : null;
  const ids = new Set<string>();
  for (const row of json?.result ?? []) {
    if (!row.detail?.startsWith("Added ")) continue;
    // "member-lamont, member-testy-couch": the page's own entry, then the child it added
    for (const id of (row.entries ?? "").split(",").slice(1)) if (id.trim()) ids.add(id.trim());
  }
  return ids;
}
