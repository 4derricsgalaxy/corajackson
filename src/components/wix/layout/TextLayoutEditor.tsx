"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { rowToCss, TEXT_FONTS, TEXT_LABELS, type TextLayoutRow } from "@/lib/content/text-layout";

/**
 * The on-page Layout tool (edit mode only). "Layout" turns it on: every text item that carries a layout
 * key gets a dashed outline; drag one to move it, or click it and change its font, size, bold, italic
 * or color in the toolbar (arrow keys nudge 1px, Shift+arrow 10px). "Save layout" writes the rows to
 * each entry's `textLayout` field through /api/text-layout, then reloads the page.
 * While it is on, clicks never reach links or the Snackbox click-to-edit overlay.
 */

type Id = string; // `${docId}::${key}`
const FLAG_ATTRS = ["data-tl-font", "data-tl-size", "data-tl-style", "data-tl-weight", "data-tl-color", "data-tl-moved"];
const VAR_NAMES = ["--tl-font", "--tl-size", "--tl-style", "--tl-weight", "--tl-color", "--tl-x", "--tl-y"];

const idOf = (el: Element): Id | null => {
  const doc = el.getAttribute("data-tl-doc");
  const key = el.getAttribute("data-tl-key");
  return doc && key ? `${doc}::${key}` : null;
};
const itemsFor = (id: Id) => {
  const [doc, key] = id.split("::");
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-tl-doc="${CSS.escape(doc)}"][data-tl-key="${CSS.escape(key)}"]`));
};
const savedRow = (el: Element): TextLayoutRow | null => {
  try {
    const raw = el.getAttribute("data-tl-row");
    return raw ? (JSON.parse(raw) as TextLayoutRow) : null;
  } catch {
    return null;
  }
};
const toHex = (rgb: string) => {
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return "#000000";
  return `#${m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
};
const labelFor = (id: Id) => {
  const key = id.split("::")[1];
  return itemsFor(id)[0]?.getAttribute("data-tl-label") || TEXT_LABELS[key] || key;
};

function applyRow(el: HTMLElement, row: TextLayoutRow | null) {
  for (const a of FLAG_ATTRS) el.removeAttribute(a);
  for (const v of VAR_NAMES) el.style.removeProperty(v);
  const { vars, flags } = rowToCss(row ?? undefined);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  for (const k of Object.keys(flags)) el.setAttribute(k, "");
}

export function TextLayoutEditor() {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<Id | null>(null);
  const [edits, setEdits] = useState<ReadonlyMap<Id, TextLayoutRow | null>>(new Map()); // render copy of `rows`
  const [atTop, setAtTop] = useState(false); // toolbar at the bottom-right unless it is in the way
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "error"; text?: string }>({ kind: "idle" });
  const rows = useRef(new Map<Id, TextLayoutRow | null>()); // unsaved values (null = back to normal), for event handlers
  const toolbar = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<Id | null>(null);
  const drag = useRef<{ id: Id; pointerId: number; sx: number; sy: number; bx: number; by: number; moved: boolean } | null>(null);

  const current = useCallback((id: Id): TextLayoutRow | null => {
    if (rows.current.has(id)) return rows.current.get(id) ?? null;
    const el = itemsFor(id)[0];
    return el ? savedRow(el) : null;
  }, []);

  const update = useCallback((id: Id, patch: Partial<TextLayoutRow> | null) => {
    const key = id.split("::")[1];
    const next: TextLayoutRow | null = patch === null ? null : { ...(current(id) ?? { key }), ...patch, key };
    if (next) for (const k of Object.keys(next) as (keyof TextLayoutRow)[]) if (next[k] === undefined) delete next[k];
    const empty = !next || Object.keys(next).length <= 1;
    rows.current.set(id, empty ? null : next);
    for (const el of itemsFor(id)) {
      applyRow(el, empty ? null : next);
      el.classList.add("tl-dirty");
    }
    setEdits(new Map(rows.current));
  }, [current]);

  // on/off: page class, selection outline, and the capture-phase event shield
  useEffect(() => {
    const root = document.documentElement;
    if (!active) {
      root.classList.remove("tl-active");
      return;
    }
    root.classList.add("tl-active");

    const inToolbar = (t: EventTarget | null) => t instanceof Node && Boolean(toolbar.current?.contains(t));
    const keyed = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>("[data-tl-key]") : null);

    const onPointerDown = (e: PointerEvent) => {
      if (inToolbar(e.target)) return;
      e.stopPropagation();
      e.preventDefault();
      const el = keyed(e.target);
      const id = el ? idOf(el) : null;
      setSelected(id);
      if (!el || !id || e.button !== 0) return;
      const row = current(id);
      drag.current = { id, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, bx: row?.x ?? 0, by: row?.y ?? 0, moved: false };
    };
    const onPointerMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) < 3) return;
      d.moved = true;
      e.preventDefault();
      update(d.id, { x: Math.round(d.bx + dx) || undefined, y: Math.round(d.by + dy) || undefined });
    };
    const onPointerUp = (e: PointerEvent) => {
      if (drag.current && e.pointerId === drag.current.pointerId) drag.current = null;
    };
    const shield = (e: Event) => {
      if (inToolbar(e.target)) return;
      e.stopPropagation();
      e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, select, textarea") || t.isContentEditable)) return;
      if (e.key === "Escape") { setSelected(null); return; }
      const step = e.shiftKey ? 10 : 1;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!delta) return;
      const sel = selectedRef.current;
      if (!sel) return;
      const row = current(sel);
      update(sel, { x: (row?.x ?? 0) + delta[0] || undefined, y: (row?.y ?? 0) + delta[1] || undefined });
      e.preventDefault();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerUp, true);
    for (const t of ["click", "mousedown", "dblclick", "auxclick", "dragstart"]) window.addEventListener(t, shield, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
      for (const t of ["click", "mousedown", "dblclick", "auxclick", "dragstart"]) window.removeEventListener(t, shield, true);
      window.removeEventListener("keydown", onKey);
      root.classList.remove("tl-active");
    };
  }, [active, current, update]);

  // selection outline follows `selected`
  useEffect(() => {
    selectedRef.current = selected;
    document.querySelectorAll(".tl-selected").forEach((el) => el.classList.remove("tl-selected"));
    if (selected && active) itemsFor(selected).forEach((el) => el.classList.add("tl-selected"));
  }, [selected, active]);

  // unsaved changes: ask before leaving the page
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (rows.current.size && status.kind !== "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status.kind]);

  const discard = () => {
    for (const id of rows.current.keys()) {
      for (const el of itemsFor(id)) {
        applyRow(el, savedRow(el));
        el.classList.remove("tl-dirty");
      }
    }
    rows.current.clear();
    setEdits(new Map());
    setStatus({ kind: "idle" });
  };

  const save = async () => {
    if (!rows.current.size) return;
    const changes: Record<string, { key: string; row: TextLayoutRow | null }[]> = {};
    for (const [id, row] of rows.current) {
      const [doc, key] = id.split("::");
      (changes[doc] ??= []).push({ key, row });
    }
    setStatus({ kind: "saving", text: "Saving…" });
    try {
      const res = await fetch("/api/text-layout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes }) });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(out.error ?? `Save failed (${res.status})`);
      rows.current.clear();
      window.location.reload();
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
  };

  const done = () => {
    if (rows.current.size && !window.confirm("You have unsaved layout changes. Throw them away?")) return;
    discard();
    setSelected(null);
    setActive(false);
  };

  if (!active) {
    return (
      <button type="button" className="tl-launch" onClick={() => setActive(true)} title="Move text and change fonts on this page">
        Layout
      </button>
    );
  }

  const el = selected ? itemsFor(selected)[0] : undefined;
  const row = selected ? (edits.has(selected) ? edits.get(selected) ?? null : el ? savedRow(el) : null) : null;
  const cs = el ? getComputedStyle(el) : undefined;
  const isBold = cs ? Number(cs.fontWeight) >= 600 : false;
  const isItalic = cs ? cs.fontStyle === "italic" : false;
  const size = row?.size ?? (cs ? Math.round(parseFloat(cs.fontSize)) : 16);
  const count = edits.size;

  return (
    <div ref={toolbar} className={atTop ? "tl-toolbar tl-top" : "tl-toolbar"} role="toolbar" aria-label="Text layout">
      <span className="tl-item">{selected ? labelFor(selected) : "Drag any outlined text, or click it to change its font"}</span>
      {selected && (
        <>
          <select
            aria-label="Font"
            value={row?.font ?? ""}
            onChange={(e) => update(selected, { font: e.target.value || undefined })}
          >
            <option value="">Normal font</option>
            {Object.keys(TEXT_FONTS).map((f) => (
              <option key={f} value={f} style={{ fontFamily: TEXT_FONTS[f] }}>{f}</option>
            ))}
          </select>
          <span className="tl-size">
            <button type="button" aria-label="Smaller" onClick={() => update(selected, { size: Math.max(8, size - 1) })}>−</button>
            <input
              type="number"
              min={8}
              max={120}
              aria-label="Size in pixels"
              value={size}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 8 && n <= 120) update(selected, { size: n });
              }}
            />
            <button type="button" aria-label="Bigger" onClick={() => update(selected, { size: Math.min(120, size + 1) })}>+</button>
          </span>
          <button type="button" className="tl-b" aria-pressed={isBold} onClick={() => update(selected, { weight: isBold ? "Regular" : "Bold" })}>B</button>
          <button type="button" className="tl-i" aria-pressed={isItalic} onClick={() => update(selected, { style: isItalic ? "Upright" : "Italic" })}>I</button>
          <input
            type="color"
            aria-label="Text color"
            value={row?.color ?? (cs ? toHex(cs.color) : "#000000")}
            onChange={(e) => update(selected, { color: e.target.value })}
          />
          <button type="button" onClick={() => update(selected, null)} title="Put this text back to normal">Reset</button>
        </>
      )}
      <span className="tl-sep" />
      {status.text && <span className={status.kind === "error" ? "tl-msg tl-err" : "tl-msg"}>{status.text}</span>}
      <button type="button" className="tl-save" disabled={!count || status.kind === "saving"} onClick={save}>
        Save layout{count ? ` (${count})` : ""}
      </button>
      <button type="button" disabled={!count || status.kind === "saving"} onClick={discard}>Undo all</button>
      <button type="button" onClick={done}>Done</button>
      <button type="button" aria-label={atTop ? "Move toolbar to the bottom" : "Move toolbar to the top"} title="Move this toolbar" onClick={() => setAtTop((v) => !v)}>⇅</button>
    </div>
  );
}
