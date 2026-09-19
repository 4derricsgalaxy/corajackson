/**
 * Helpers for the free-text `parentNote` field on a family member, e.g.
 *   "Father: Greg McDanial (never married)"
 *   "Mother: Angela Gooden (married 1982 to 2000, divorced)"
 *   "Mother: Tacia Bond"
 */

export interface ParsedParentNote {
  /** "Father", "Mother", … ("Family" when the note has no colon) */
  role: string;
  /** The other parent's name (or the whole note when there is no colon) */
  name: string;
  /** Title-cased parenthetical, e.g. "Never Married" */
  status?: string;
}

const SMALL_WORDS = new Set(["to", "of", "and", "in", "the", "a", "an", "at", "on", "for"]);

export function titleCase(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.replace(/^([^a-z]*)([a-z])/, (_, lead: string, ch: string) => lead + ch.toUpperCase());
    })
    .join(" ");
}

export function parseParentNote(note: string): ParsedParentNote {
  let rest = note.trim();
  let status: string | undefined;
  const paren = rest.match(/\(([^)]*)\)\s*$/);
  if (paren) {
    status = titleCase(paren[1]) || undefined;
    rest = rest.slice(0, paren.index).trim();
  }
  const colon = rest.indexOf(":");
  if (colon > 0) {
    return { role: rest.slice(0, colon).trim(), name: rest.slice(colon + 1).trim(), status };
  }
  return { role: "Family", name: rest, status };
}

/** Splits "Label: value" for the fact column; label falls back to "Family:". */
export function splitNote(note: string): { label: string; value: string } {
  const colon = note.indexOf(":");
  if (colon > 0) return { label: `${note.slice(0, colon).trim()}:`, value: note.slice(colon + 1).trim() };
  return { label: "Family:", value: note.trim() };
}

export interface NoteGroup<T> {
  key: string;
  note?: ParsedParentNote;
  members: T[];
}

/**
 * Groups children by the other parent named in their `parentNote` (role + name, so
 * "Mother: Angela Gooden" and "Mother: Angela Gooden (married …)" share one block; the first
 * parenthetical found supplies the Marital Status line). First-appearance order; un-noted children last.
 */
export function groupByParentNote<T extends { parentNote?: string }>(children: T[]): NoteGroup<T>[] {
  const groups = new Map<string, NoteGroup<T>>();
  const unnoted: T[] = [];
  for (const child of children) {
    const raw = child.parentNote?.trim();
    if (!raw) { unnoted.push(child); continue; }
    const note = parseParentNote(raw);
    const key = `${note.role}|${note.name}`.toLowerCase().replace(/\s+/g, " ");
    const existing = groups.get(key);
    if (existing) {
      existing.members.push(child);
      if (existing.note && !existing.note.status && note.status) existing.note.status = note.status;
    } else groups.set(key, { key, note, members: [child] });
  }
  const out = [...groups.values()];
  if (unnoted.length) out.push({ key: "__none__", members: unnoted });
  return out;
}

/** Loose name key so "Angela Gooden" matches "angela  gooden" typed in another field. */
export const nameKey = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function firstName(person: { title: string; nickname?: string }): string {
  return person.nickname ?? person.title.split(" ")[0];
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s'-]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "1955-05-19" → "May 19, 1955"; year-only strings and unparseable values pass through. UTC. */
export function formatDate(iso: string): string {
  const s = iso.trim();
  if (/^\d{4}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
