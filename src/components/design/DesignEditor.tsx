"use client";

import { HeicDecodeError, PHOTO_ACCEPT, preparePhoto } from "@/lib/photos/prepare";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cleanDesign, emptyDesign, FONTS, isEmptyDesign, newId, type Added, type Design, type Look } from "@/lib/design/model";
import { PIECE_LABELS } from "@/lib/design/keys";
import { canCrop, openCrop } from "./CropDialog";
import { snapshot } from "./snapshot";
import { designStore, isDirty, useDesignState } from "./store";

/**
 * The on-page Design tool (edit mode only). "Design" turns it on for the page you are on:
 * - click anything to select it (the page's own pieces and things you added); drag to move, handles resize
 * - the side panel changes font, size, bold/italic/underline, colors, fill, border, corners, shadow,
 *   see-through, turn, layer order, exact position and size; Crop for pictures
 * - Cut / Copy / Paste / Duplicate / Delete (also Ctrl+X/C/V/D, Delete); copies can be pasted on any page
 * - Add text, pictures (family photos, your computer, a web address) and shapes, in front or behind
 * - Page: background color / picture / surround, hidden pieces, copy this design to other pages,
 *   default format, earlier saved versions
 * - Undo / Redo (Ctrl+Z / Ctrl+Y); nothing is public until Save
 * The page's own content (names, words, photos) is still changed in Snackbox; "Edit in Snackbox" jumps there.
 */

type Sel = { kind: "piece"; key: string } | { kind: "added"; id: string } | { kind: "page" } | null;
type Picked = { src: string; srcset?: string; w?: number | null; h?: number | null; alt?: string };
type Library = { pictures: { t: string; p: string[]; u: string; s?: string; w?: number | null; h?: number | null }[]; pages: { path: string; title: string; group: string }[] };
type Modal = null | { kind: "picture"; purpose: "add" | "replace" | "page" } | { kind: "copy" } | { kind: "versions" };

const CLIP_KEY = "cj-design-clipboard";
const FILLS = ["#ffffff", "#000000", "#292f33", "#727272", "#b5b5b5", "#566fb8", "#9db8b2", "#7a1f1f", "#d97706", "#f5e6c8", "#2f6fed", "#1f7a3a"];
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

const canvasEl = () => document.querySelector<HTMLElement>(".wix-canvas[data-pd-path]");
const pieceEl = (key: string) => document.querySelector<HTMLElement>(`[data-pd="${CSS.escape(key)}"]`);
const addedEl = (id: string) => document.querySelector<HTMLElement>(`[data-pd-id="${CSS.escape(id)}"]`);
const selEl = (s: Sel) => (s?.kind === "piece" ? pieceEl(s.key) : s?.kind === "added" ? addedEl(s.id) : s?.kind === "page" ? canvasEl() : null);
const inUi = (t: EventTarget | null) => t instanceof Element && Boolean(t.closest(".pd-ui, .ic-modal"));
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (Boolean(t.closest("input, textarea, select")) || t.isContentEditable);

function pieceLabel(el: Element | null, key: string) {
  const own = el?.getAttribute("data-pd-label");
  if (own) return own;
  const base = key.split("--").pop() ?? key;
  return PIECE_LABELS[base] ?? PIECE_LABELS[key] ?? base.replace(/-/g, " ");
}

/** a copy of the design with one piece's / added thing's look changed (undefined values = back to normal) */
function withLook(d: Design, sel: Sel, patch: Partial<Added>): Design {
  if (sel?.kind === "piece") {
    const cur: Look = { ...(d.items[sel.key] ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete (cur as Record<string, unknown>)[k];
      else (cur as Record<string, unknown>)[k] = v;
    }
    const items = { ...d.items };
    if (Object.keys(cur).length) items[sel.key] = cur;
    else delete items[sel.key];
    return { ...d, items };
  }
  if (sel?.kind === "added") {
    return {
      ...d,
      added: d.added.map((a) => {
        if (a.id !== sel.id) return a;
        const next = { ...a } as Record<string, unknown>;
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined) delete next[k];
          else next[k] = v;
        }
        return next as unknown as Added;
      }),
    };
  }
  return d;
}

function readClip(): { from: string; items: Added[] } | null {
  try {
    const raw = window.localStorage.getItem(CLIP_KEY);
    return raw ? (JSON.parse(raw) as { from: string; items: Added[] }) : null;
  } catch {
    return null;
  }
}
function writeClip(from: string, items: Added[]) {
  try {
    window.localStorage.setItem(CLIP_KEY, JSON.stringify({ from, items }));
  } catch {
    /* storage full or blocked: copy works on this page only */
  }
}

/** every picture (iPhone HEIC too) becomes an upright JPEG of at most 2400px before upload (shared with "Add photos") */
async function prepareUpload(file: File): Promise<{ blob: Blob; name: string; w: number; h: number }> {
  try {
    return await preparePhoto(file);
  } catch (err) {
    throw new Error(err instanceof HeicDecodeError ? "This browser can't read that iPhone photo. Use “Add photos”, or save it as a JPG first." : (err as Error).message);
  }
}

async function upload(file: File): Promise<Picked> {
  const { blob, name, w, h } = await prepareUpload(file);
  const form = new FormData();
  form.set("file", blob, name);
  form.set("alt", file.name.replace(/\.\w+$/, ""));
  const res = await fetch("/api/design/upload", { method: "POST", body: form });
  const out = (await res.json().catch(() => ({}))) as { url?: string; srcset?: string; width?: number | null; height?: number | null; error?: string };
  if (!res.ok || !out.url) throw new Error(out.error ?? `Upload failed (${res.status})`);
  return { src: out.url, srcset: out.srcset, w: out.width ?? w, h: out.height ?? h, alt: file.name.replace(/\.\w+$/, "") };
}

export function DesignEditor() {
  const s = useDesignState();
  const [active, setActive] = useState(false);
  const [sel, setSel] = useState<Sel>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "error"; text?: string }>({ kind: "idle" });
  const [modal, setModal] = useState<Modal>(null);
  const [panelLeft, setPanelLeft] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [, force] = useState(0);
  const overlay = useRef<HTMLDivElement>(null);
  const selRef = useRef<Sel>(null);
  const drag = useRef<null | {
    pointerId: number; sx: number; sy: number; moved: boolean; sel: Sel; mode: "move" | Handle;
    x0: number; y0: number; w0: number; h0: number; k: number; ratio: number; clickTarget?: Element | null;
  }>(null);
  const dirty = isDirty(s);
  const path = s.path;

  useEffect(() => {
    selRef.current = sel;
  }, [sel]);

  const commit = useCallback((d: Design) => designStore.commit(d), []);
  const apply = useCallback((patch: Partial<Added>, mode: "commit" | "live" = "commit") => {
    const cur = selRef.current;
    const next = withLook(designStore.get().design, cur, patch);
    if (mode === "live") designStore.live(next);
    else commit(next);
  }, [commit]);

  /* ---------- on / off ---------- */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("pd-editing", active);
    return () => root.classList.remove("pd-editing");
  }, [active]);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 980);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // unsaved changes: ask before leaving the page
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (isDirty(designStore.get())) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // hidden pieces show faintly while designing, so they can be picked and brought back
  useEffect(() => {
    if (!active) return;
    document.querySelectorAll(".pd-ghost").forEach((el) => el.classList.remove("pd-ghost"));
    for (const [key, look] of Object.entries(s.design.items)) if (look.hidden) pieceEl(key)?.classList.add("pd-ghost");
    return () => document.querySelectorAll(".pd-ghost").forEach((el) => el.classList.remove("pd-ghost"));
  }, [active, s.design]);

  /* ---------- selection frame follows the selected thing (every frame: pages move while you work) ---------- */
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const box = overlay.current;
      const el = selEl(selRef.current);
      if (box) {
        if (el && selRef.current?.kind !== "page") {
          const r = el.getBoundingClientRect();
          box.style.display = "block";
          box.style.left = `${r.left}px`;
          box.style.top = `${r.top}px`;
          box.style.width = `${r.width}px`;
          box.style.height = `${r.height}px`;
        } else box.style.display = "none";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  /* ---------- clipboard actions ---------- */
  const copySel = useCallback((cut: boolean) => {
    const cur = selRef.current;
    const d = designStore.get().design;
    const canvas = canvasEl();
    if (!cur || cur.kind === "page" || !canvas) return;
    if (cur.kind === "added") {
      const a = d.added.find((x) => x.id === cur.id);
      if (!a) return;
      writeClip(path, [a]);
      if (cut) {
        commit({ ...d, added: d.added.filter((x) => x.id !== a.id) });
        setSel(null);
      }
    } else {
      const el = pieceEl(cur.key);
      if (!el) return;
      writeClip(path, [snapshot(el, canvas, designStore.get().baseW, pieceLabel(el, cur.key))]);
      if (cut) commit(withLook(d, cur, { hidden: true }));
    }
    setStatus({ kind: "ok", text: cut ? "Cut. Paste it here or on any page." : "Copied. Paste it here or on any page." });
  }, [commit, path]);

  const paste = useCallback(() => {
    const clip = readClip();
    if (!clip?.items.length) {
      setStatus({ kind: "error", text: "Nothing copied yet." });
      return;
    }
    const d = designStore.get().design;
    const same = clip.from === path;
    const items = clip.items.map((a) => ({ ...a, id: newId(), x: a.x + (same ? 20 : 0), y: a.y + (same ? 20 : 0) }));
    commit({ ...d, added: [...d.added, ...items] });
    setSel({ kind: "added", id: items[items.length - 1].id });
    setStatus({ kind: "idle" });
  }, [commit, path]);

  const duplicate = useCallback(() => {
    const cur = selRef.current;
    const d = designStore.get().design;
    const canvas = canvasEl();
    if (!cur || cur.kind === "page" || !canvas) return;
    let item: Added | undefined;
    if (cur.kind === "added") {
      const a = d.added.find((x) => x.id === cur.id);
      if (a) item = { ...a, id: newId(), x: a.x + 20, y: a.y + 20 };
    } else {
      const el = pieceEl(cur.key);
      if (el) {
        const snap = snapshot(el, canvas, designStore.get().baseW, pieceLabel(el, cur.key));
        item = { ...snap, x: snap.x + 20, y: snap.y + 20 };
      }
    }
    if (!item) return;
    commit({ ...d, added: [...d.added, item] });
    setSel({ kind: "added", id: item.id });
  }, [commit]);

  const remove = useCallback(() => {
    const cur = selRef.current;
    const d = designStore.get().design;
    if (!cur || cur.kind === "page") return;
    if (cur.kind === "added") {
      commit({ ...d, added: d.added.filter((x) => x.id !== cur.id) });
      setSel(null);
    } else {
      commit(withLook(d, cur, { hidden: true }));
    }
  }, [commit]);

  /* ---------- pointer + keyboard on the page ---------- */
  useEffect(() => {
    if (!active) return;
    let hovered: Element | null = null;
    const hit = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>("[data-pd-id], [data-pd]") : null);
    const selOf = (el: HTMLElement): Sel => {
      const id = el.getAttribute("data-pd-id");
      if (id) return { kind: "added", id };
      return { kind: "piece", key: el.getAttribute("data-pd")! };
    };

    const startDrag = (e: PointerEvent, target: Sel, mode: "move" | Handle, clickTarget?: Element | null) => {
      const el = selEl(target);
      const canvas = canvasEl();
      if (!el || !canvas) return;
      const { design, baseW } = designStore.get();
      const r = el.getBoundingClientRect();
      const k = canvas.getBoundingClientRect().width / baseW || 1;
      let x0 = 0, y0 = 0, w0 = r.width, h0 = r.height;
      if (target?.kind === "added") {
        const a = design.added.find((x) => x.id === target.id);
        if (!a) return;
        ({ x: x0, y: y0, w: w0, h: h0 } = a);
      } else if (target?.kind === "piece") {
        const look = design.items[target.key] ?? {};
        x0 = look.x ?? 0;
        y0 = look.y ?? 0;
      }
      drag.current = { pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, sel: target, mode, x0, y0, w0, h0, k, ratio: w0 / Math.max(1, h0), clickTarget };
    };

    const onDown = (e: PointerEvent) => {
      if (inUi(e.target)) {
        const h = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-pd-handle]") : null;
        if (h && selRef.current) {
          e.preventDefault();
          startDrag(e, selRef.current, h.getAttribute("data-pd-handle") as Handle);
        }
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      if (e.button !== 0) return;
      const el = hit(e.target);
      const cur = selRef.current;
      const curEl = selEl(cur);
      // pressing inside the selected thing drags it; a click without moving then picks what is under the pointer
      if (cur && cur.kind !== "page" && curEl && e.target instanceof Node && curEl.contains(e.target)) {
        startDrag(e, cur, "move", el);
        return;
      }
      if (el) {
        const next = selOf(el);
        setSel(next);
        selRef.current = next;
        startDrag(e, next, "move");
        return;
      }
      const canvas = canvasEl();
      setSel(canvas && e.target instanceof Node && canvas.contains(e.target) ? { kind: "page" } : null);
    };

    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) {
        if (!d) {
          const el = hit(e.target);
          if (el !== hovered) {
            hovered?.classList.remove("pd-hover");
            if (el && !inUi(e.target)) el.classList.add("pd-hover");
            hovered = el;
          }
        }
        return;
      }
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.moved) {
        if (Math.hypot(dx, dy) < 3) return;
        d.moved = true;
        designStore.checkpoint();
      }
      e.preventDefault();
      const added = d.sel?.kind === "added";
      const kx = added ? d.k : 1; // added things are placed in page px; page pieces move in screen px
      if (d.mode === "move") {
        const patch = { x: Math.round(d.x0 + dx / kx), y: Math.round(d.y0 + dy) };
        designStore.live(withLook(designStore.get().design, d.sel, added ? patch : { x: patch.x || undefined, y: patch.y || undefined }));
        return;
      }
      const east = d.mode.includes("e"), west = d.mode.includes("w"), south = d.mode.includes("s"), north = d.mode.includes("n");
      let w = d.w0 + (east ? dx : west ? -dx : 0) / (added ? kx : 1);
      let h = d.h0 + (south ? dy : north ? -dy : 0);
      const corner = (east || west) && (north || south);
      const isPicture = Boolean(selEl(d.sel)?.querySelector("img") || selEl(d.sel) instanceof HTMLImageElement);
      if (corner && isPicture !== e.shiftKey) {
        const f = Math.max(w / d.w0, h / d.h0);
        w = d.w0 * f;
        h = d.h0 * f;
      }
      w = Math.max(8, Math.round(w));
      h = Math.max(8, Math.round(h));
      const x = Math.round(west ? d.x0 + (d.w0 - w) : d.x0);
      const y = Math.round(north ? d.y0 + (d.h0 - h) : d.y0);
      const patch: Partial<Added> = { w, h };
      if (west) patch.x = added ? x : x || undefined;
      if (north) patch.y = added ? y : y || undefined;
      if (!east && !west) delete patch.w;
      if (!north && !south) delete patch.h;
      designStore.live(withLook(designStore.get().design, d.sel, patch));
    };

    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      drag.current = null;
      if (!d.moved && d.clickTarget) {
        const next = selOf(d.clickTarget as HTMLElement);
        setSel(next);
      }
    };

    const shield = (e: Event) => {
      if (inUi(e.target)) return;
      e.stopPropagation();
      e.preventDefault();
    };
    const onDbl = (e: MouseEvent) => {
      shield(e);
      if (selRef.current?.kind === "added") document.querySelector<HTMLTextAreaElement>(".pd-ui textarea[data-pd-text]")?.focus();
    };

    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z" && !e.shiftKey) { designStore.undo(); e.preventDefault(); return; }
      if (mod && (k === "y" || (k === "z" && e.shiftKey))) { designStore.redo(); e.preventDefault(); return; }
      if (mod && k === "c") { copySel(false); e.preventDefault(); return; }
      if (mod && k === "x") { copySel(true); e.preventDefault(); return; }
      if (mod && k === "d") { duplicate(); e.preventDefault(); return; }
      if (mod && k === "s") { document.querySelector<HTMLButtonElement>(".pd-ui [data-pd-save]")?.click(); e.preventDefault(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { remove(); e.preventDefault(); return; }
      if (e.key === "Escape") { setSel(null); return; }
      const step = e.shiftKey ? 10 : 1;
      const delta = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[k];
      const cur = selRef.current;
      if (!delta || !cur || cur.kind === "page") return;
      e.preventDefault();
      const d = designStore.get().design;
      if (cur.kind === "added") {
        const a = d.added.find((x) => x.id === cur.id);
        if (a) commit(withLook(d, cur, { x: a.x + delta[0], y: a.y + delta[1] }));
      } else {
        const look = d.items[cur.key] ?? {};
        commit(withLook(d, cur, { x: (look.x ?? 0) + delta[0] || undefined, y: (look.y ?? 0) + delta[1] || undefined }));
      }
    };
    // Ctrl+V: a picture copied from anywhere is uploaded and placed; else the Design tool's own clipboard
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      e.preventDefault();
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) {
        setStatus({ kind: "busy", text: "Uploading picture…" });
        upload(file)
          .then((p) => { addPicture(p); setStatus({ kind: "idle" }); })
          .catch((err: Error) => setStatus({ kind: "error", text: err.message }));
        return;
      }
      paste();
    };

    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    for (const t of ["click", "mousedown", "auxclick", "dragstart", "contextmenu"]) window.addEventListener(t, shield, true);
    window.addEventListener("dblclick", onDbl, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      for (const t of ["click", "mousedown", "auxclick", "dragstart", "contextmenu"]) window.removeEventListener(t, shield, true);
      window.removeEventListener("dblclick", onDbl, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
      hovered?.classList.remove("pd-hover");
    };
    // addPicture is stable enough (reads the store); listing it would re-bind every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, commit, copySel, duplicate, paste, remove]);

  /* ---------- adding things ---------- */
  // new things land in the middle of the part of the page you are looking at
  const spot = (w: number, h: number) => {
    const canvas = canvasEl();
    const { baseW } = designStore.get();
    if (!canvas) return { x: 40, y: 40 };
    const r = canvas.getBoundingClientRect();
    const y = Math.max(0, -r.top) + Math.max(60, (window.innerHeight - h) / 2 - Math.max(0, r.top));
    return { x: Math.round(Math.max(0, (baseW - w) / 2)), y: Math.round(Math.min(y, Math.max(20, r.height - h - 20))) };
  };
  const addThing = (item: Omit<Added, "id" | "x" | "y"> & Partial<Pick<Added, "x" | "y">>) => {
    const pos = spot(item.w, item.h);
    const a = { ...pos, ...item, id: newId() } as Added;
    commit({ ...designStore.get().design, added: [...designStore.get().design.added, a] });
    setSel({ kind: "added", id: a.id });
  };
  const addText = () => addThing({ kind: "text", layer: "front", w: 320, h: 60, text: "Your text here", size: 22, color: "#292f33", font: "Proxima Nova" });
  const addShape = (shape: "box" | "circle" | "line") =>
    addThing(
      shape === "line"
        ? { kind: "box", layer: "front", w: 300, h: 3, bg: "#292f33" }
        : { kind: "box", layer: "front", w: 200, h: shape === "circle" ? 200 : 130, bg: "#d9d9d9", radius: shape === "circle" ? 1000 : 0 },
    );
  function addPicture(p: Picked) {
    const w = 300;
    const h = p.w && p.h ? Math.round((w * p.h) / p.w) : 300;
    addThing({ kind: "image", layer: "front", w, h, src: p.src, srcset: p.srcset, alt: p.alt, iw: p.w ?? undefined, ih: p.h ?? undefined, fit: "cover" });
  }
  const onPicked = (p: Picked) => {
    const m = modal;
    setModal(null);
    if (m?.kind !== "picture") return;
    if (m.purpose === "add") addPicture(p);
    else if (m.purpose === "replace") apply({ src: p.src, srcset: p.srcset, alt: p.alt, iw: p.w ?? undefined, ih: p.h ?? undefined, crop: undefined });
    else commit({ ...designStore.get().design, page: { ...designStore.get().design.page, image: p.src } });
  };

  /* ---------- save / reset / done ---------- */
  const save = async () => {
    setStatus({ kind: "busy", text: "Saving…" });
    try {
      const design = designStore.get().design;
      const res = await fetch("/api/design", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, design }) });
      const out = (await res.json().catch(() => ({}))) as { error?: string; design?: Design | null };
      if (!res.ok) throw new Error(out.error ?? `Save failed (${res.status})`);
      designStore.markSaved(design);
      setStatus({ kind: "ok", text: "Saved. Visitors see it now." });
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    }
  };
  const defaultFormat = () => {
    if (!window.confirm("Put this page back to its default format?\n\nEvery move, size, font, color and background change is undone and the things you added are removed. Nothing is public until you press Save, and Undo brings it all back.")) return;
    commit(emptyDesign());
    setSel(null);
  };
  const done = () => {
    if (isDirty(designStore.get()) && !window.confirm("You have changes that are not saved. Close the Design tool and throw them away?")) return;
    if (isDirty(designStore.get())) designStore.discard();
    setSel(null);
    setModal(null);
    setActive(false);
  };
  const editInSnackbox = () => {
    const el = selEl(selRef.current);
    const field = el?.matches("[data-sbx-field]") ? el : el?.querySelector<HTMLElement>("[data-sbx-field]") ?? el?.closest<HTMLElement>("[data-sbx-field]");
    setSel(null);
    setActive(false); // unsaved design changes stay on the page; open Design again to save them
    if (field) window.setTimeout(() => field.click(), 80);
  };

  /* ---------- render ---------- */
  if (!active) {
    return (
      <button type="button" className="pd-ui pd-launch" onClick={() => { force((n) => n + 1); setActive(true); setStatus({ kind: "idle" }); }} title="Move, resize, restyle and add things on this page">
        Design{dirty ? " •" : ""}
      </button>
    );
  }

  const canvas = typeof document !== "undefined" ? canvasEl() : null;
  if (!canvas || !path) {
    return (
      <div className="pd-ui pd-bar">
        <strong>Design</strong>
        <span className="pd-msg">This page can&apos;t be designed.</span>
        <span className="pd-grow" />
        <button type="button" onClick={() => setActive(false)}>Done</button>
      </div>
    );
  }

  return (
    <>
      <div className="pd-ui pd-bar" role="toolbar" aria-label="Design">
        <strong className="pd-title" title={path}>Design</strong>
        <button type="button" onClick={addText}>+ Text</button>
        <button type="button" onClick={() => setModal({ kind: "picture", purpose: "add" })}>+ Picture</button>
        <ShapeMenu onPick={addShape} />
        <span className="pd-sep" />
        <button type="button" onClick={() => designStore.undo()} disabled={!s.past.length} title="Undo (Ctrl+Z)">↶ Undo</button>
        <button type="button" onClick={() => designStore.redo()} disabled={!s.future.length} title="Redo (Ctrl+Y)">↷ Redo</button>
        <span className="pd-sep" />
        <button type="button" onClick={() => copySel(true)} disabled={!sel || sel.kind === "page"} title="Cut (Ctrl+X)">Cut</button>
        <button type="button" onClick={() => copySel(false)} disabled={!sel || sel.kind === "page"} title="Copy (Ctrl+C)">Copy</button>
        <button type="button" onClick={paste} title="Paste (Ctrl+V) — also works on another page">Paste</button>
        <button type="button" onClick={duplicate} disabled={!sel || sel.kind === "page"} title="Duplicate (Ctrl+D)">Duplicate</button>
        <button type="button" onClick={remove} disabled={!sel || sel.kind === "page"} title="Delete">Delete</button>
        <span className="pd-sep" />
        <button type="button" onClick={() => setSel({ kind: "page" })} aria-pressed={sel?.kind === "page"}>Page</button>
        <span className="pd-grow" />
        {narrow && <span className="pd-msg pd-warn">Widen the window to at least 980px to move page pieces.</span>}
        {status.text && <span className={status.kind === "error" ? "pd-msg pd-err" : "pd-msg"}>{status.text}</span>}
        <button type="button" className="pd-primary" data-pd-save="" disabled={!dirty || status.kind === "busy"} onClick={save} title="Save (Ctrl+S)">
          {dirty ? "Save" : "Saved"}
        </button>
        <button type="button" onClick={done}>Done</button>
      </div>

      <div ref={overlay} className="pd-ui pd-frame" aria-hidden>
        {sel?.kind !== "page" && HANDLES.map((h) => <span key={h} className={`pd-handle pd-h-${h}`} data-pd-handle={h} />)}
      </div>

      <aside className={panelLeft ? "pd-ui pd-panel pd-panel-left" : "pd-ui pd-panel"} aria-label="Design settings">
        <div className="pd-panel-top">
          <button type="button" className="pd-mini" onClick={() => setPanelLeft((v) => !v)} title="Move this panel to the other side">⇆</button>
        </div>
        {sel?.kind === "page" || !sel ? (
          <PagePanel personPage={/^\/family\/[^/]+$/.test(path ?? "")} design={s.design} commit={commit} onPicture={() => setModal({ kind: "picture", purpose: "page" })} onCopy={() => setModal({ kind: "copy" })} onVersions={() => setModal({ kind: "versions" })} onDefault={defaultFormat} onShow={(key) => { commit(withLook(designStore.get().design, { kind: "piece", key }, { hidden: undefined })); setSel({ kind: "piece", key }); }} selected={sel?.kind === "page"} />
        ) : (
          <ItemPanel key={sel.kind === "piece" ? sel.key : sel.id} sel={sel} design={s.design} apply={apply} commit={commit} setSel={setSel} onReplace={() => setModal({ kind: "picture", purpose: "replace" })} onSnackbox={editInSnackbox} />
        )}
      </aside>

      {modal?.kind === "picture" && <PicturePicker onPick={onPicked} onClose={() => setModal(null)} />}
      {modal?.kind === "copy" && <CopyToPages path={path} onClose={() => setModal(null)} />}
      {modal?.kind === "versions" && <Versions path={path} onLoad={(d) => { commit(d ?? emptyDesign()); setModal(null); }} onClose={() => setModal(null)} />}
    </>
  );
}

/* ================= panels ================= */

function ShapeMenu({ onPick }: { onPick: (s: "box" | "circle" | "line") => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="pd-menu">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>+ Shape ▾</button>
      {open && (
        <span className="pd-menu-list" onMouseLeave={() => setOpen(false)}>
          <button type="button" onClick={() => { onPick("box"); setOpen(false); }}>Rectangle</button>
          <button type="button" onClick={() => { onPick("circle"); setOpen(false); }}>Circle</button>
          <button type="button" onClick={() => { onPick("line"); setOpen(false); }}>Line</button>
        </span>
      )}
    </span>
  );
}

function ColorField({ label, value, fallback, onLive, onReset, allowNone, onNone }: {
  label: string; value?: string; fallback: string; onLive: (v: string) => void; onReset: () => void; allowNone?: boolean; onNone?: () => void;
}) {
  return (
    <div className="pd-row">
      <span className="pd-lab">{label}</span>
      <input type="color" value={value && value !== "none" ? value : fallback} onFocus={() => designStore.checkpoint()} onPointerDown={() => designStore.checkpoint()} onChange={(e) => onLive(e.target.value)} />
      <span className="pd-swatches">
        {FILLS.map((c) => (
          <button key={c} type="button" className="pd-swatch" style={{ background: c }} title={c} onClick={() => { designStore.checkpoint(); onLive(c); }} />
        ))}
      </span>
      {allowNone && <button type="button" className="pd-mini" onClick={onNone} aria-pressed={value === "none"}>None</button>}
      <button type="button" className="pd-mini" onClick={onReset} title="Back to normal">↺</button>
    </div>
  );
}

function NumField({ label, value, placeholder, min, max, step = 1, onLive }: {
  label: string; value?: number; placeholder?: number; min: number; max: number; step?: number; onLive: (v: number | undefined) => void;
}) {
  return (
    <label className="pd-num">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        placeholder={placeholder !== undefined ? String(Math.round(placeholder)) : ""}
        onFocus={() => designStore.checkpoint()}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onLive(undefined);
          const n = Number(raw);
          if (Number.isFinite(n)) onLive(Math.min(max, Math.max(min, n)));
        }}
      />
    </label>
  );
}

function ItemPanel({ sel, design, apply, commit, setSel, onReplace, onSnackbox }: {
  sel: Exclude<Sel, null | { kind: "page" }>;
  design: Design;
  apply: (patch: Partial<Added>, mode?: "commit" | "live") => void;
  commit: (d: Design) => void;
  setSel: (s: Sel) => void;
  onReplace: () => void;
  onSnackbox: () => void;
}) {
  const el = selEl(sel);
  const look: Partial<Added> = sel.kind === "piece" ? design.items[sel.key] ?? {} : design.added.find((a) => a.id === sel.id) ?? {};
  const added = sel.kind === "added" ? (look as Added) : undefined;
  const cs = el ? getComputedStyle(el) : undefined;
  const rect = el?.getBoundingClientRect();
  const label = sel.kind === "piece" ? pieceLabel(el, sel.key) : added?.label ? `Copy of ${added.label}` : ({ text: "Text box", image: "Picture", box: "Shape", html: "Copied piece" } as const)[added?.kind ?? "box"];
  const parent = sel.kind === "piece" ? el?.parentElement?.closest<HTMLElement>("[data-pd]") : null;
  const img = el instanceof HTMLImageElement ? el : el?.querySelector("img");
  const cmsField = sel.kind === "piece" && el && (el.matches("[data-sbx-field]") || el.querySelector("[data-sbx-field]") || el.closest("[data-sbx-field]"));
  const hasText = Boolean(added?.kind === "text" || (sel.kind === "piece" && (el?.textContent ?? "").trim()));
  const [, reread] = useState(0);
  useEffect(() => {
    // a thing added a moment ago is on the page only after the first render: read its look again
    const raf = requestAnimationFrame(() => reread(1));
    return () => cancelAnimationFrame(raf);
  }, []);
  const size = look.size ?? (cs ? Math.round(parseFloat(cs.fontSize)) : 16);
  const bold = look.bold ?? (cs ? Number(cs.fontWeight) >= 600 : false);
  const italic = look.italic ?? cs?.fontStyle === "italic";
  const underline = look.underline ?? Boolean(cs?.textDecorationLine.includes("underline"));

  return (
    <div className="pd-sections">
      <div className="pd-head">
        <strong>{label}</strong>
        {look.hidden && <span className="pd-tag">Deleted from this page</span>}
      </div>
      <div className="pd-row pd-wrap">
        {parent && <button type="button" onClick={() => setSel({ kind: "piece", key: parent.getAttribute("data-pd")! })} title="Select what this sits in">↑ Bigger piece</button>}
        {look.hidden && <button type="button" className="pd-primary" onClick={() => apply({ hidden: undefined })}>Bring back</button>}
        {cmsField && <button type="button" onClick={onSnackbox} title="Change the words or photo itself in Snackbox">Edit in Snackbox</button>}
        {img && (added?.kind === "image" ? (
          <>
            <button type="button" onClick={() => openCrop(img as HTMLImageElement, (crop, size) => apply({ crop: crop ?? undefined, iw: size.w, ih: size.h }))}>Crop</button>
            <button type="button" onClick={onReplace}>Replace picture</button>
          </>
        ) : canCrop(img as HTMLImageElement) ? (
          <button type="button" onClick={() => openCrop(img as HTMLImageElement)}>Crop photo</button>
        ) : null)}
      </div>

      {added?.kind === "text" && (
        <details open className="pd-sec">
          <summary>Words</summary>
          <textarea data-pd-text="" rows={4} value={added.text ?? ""} onFocus={() => designStore.checkpoint()} onChange={(e) => apply({ text: e.target.value }, "live")} />
        </details>
      )}

      {hasText && (
        <details open className="pd-sec">
          <summary>Text</summary>
          <div className="pd-row">
            <select value={look.font ?? ""} onChange={(e) => apply({ font: e.target.value || undefined })} aria-label="Font">
              <option value="">Normal font</option>
              {Object.keys(FONTS).map((f) => <option key={f} value={f} style={{ fontFamily: FONTS[f] }}>{f}</option>)}
            </select>
          </div>
          <div className="pd-row">
            <button type="button" className="pd-mini" onClick={() => apply({ size: Math.max(6, size - 1) })} aria-label="Smaller">−</button>
            <NumField label="Size" value={look.size} placeholder={size} min={6} max={200} onLive={(v) => apply({ size: v }, "live")} />
            <button type="button" className="pd-mini" onClick={() => apply({ size: Math.min(200, size + 1) })} aria-label="Bigger">+</button>
            <button type="button" className="pd-mini pd-b" aria-pressed={bold} onClick={() => apply({ bold: !bold })}>B</button>
            <button type="button" className="pd-mini pd-i" aria-pressed={italic} onClick={() => apply({ italic: !italic })}>I</button>
            <button type="button" className="pd-mini pd-u" aria-pressed={underline} onClick={() => apply({ underline: !underline })}>U</button>
          </div>
          <div className="pd-row">
            {(["left", "center", "right"] as const).map((a) => (
              <button key={a} type="button" className="pd-mini" aria-pressed={look.align === a} onClick={() => apply({ align: look.align === a ? undefined : a })}>{a === "left" ? "⟸" : a === "center" ? "≡" : "⟹"}</button>
            ))}
          </div>
          <ColorField label="Color" value={look.color} fallback="#000000" onLive={(v) => apply({ color: v }, "live")} onReset={() => apply({ color: undefined })} />
        </details>
      )}

      <details open className="pd-sec">
        <summary>Box</summary>
        <ColorField label="Fill" value={look.bg} fallback="#ffffff" onLive={(v) => apply({ bg: v }, "live")} onReset={() => apply({ bg: undefined })} allowNone onNone={() => apply({ bg: "none" })} />
        <div className="pd-row">
          <NumField label="Border" value={look.borderW} min={0} max={60} onLive={(v) => apply({ borderW: v, borderC: look.borderC ?? (v ? "#000000" : undefined) }, "live")} />
          <input type="color" value={look.borderC ?? "#000000"} onFocus={() => designStore.checkpoint()} onChange={(e) => apply({ borderC: e.target.value, borderW: look.borderW ?? 1 }, "live")} aria-label="Border color" />
          <NumField label="Corners" value={look.radius} min={0} max={1000} onLive={(v) => apply({ radius: v }, "live")} />
        </div>
        <div className="pd-row">
          <label className="pd-check"><input type="checkbox" checked={Boolean(look.shadow)} onChange={(e) => apply({ shadow: e.target.checked || undefined })} /> Shadow</label>
          {added?.kind === "image" && (
            <select value={added.fit ?? "cover"} onChange={(e) => apply({ fit: e.target.value as "cover" | "contain" })} aria-label="Picture fit">
              <option value="cover">Fill the box</option>
              <option value="contain">Show whole picture</option>
            </select>
          )}
        </div>
        <label className="pd-range">
          <span>See-through</span>
          <input type="range" min={0} max={100} value={look.opacity ?? 100} onPointerDown={() => designStore.checkpoint()} onChange={(e) => apply({ opacity: Number(e.target.value) === 100 ? undefined : Number(e.target.value) }, "live")} />
        </label>
      </details>

      <details open className="pd-sec">
        <summary>Place and size</summary>
        <div className="pd-row pd-wrap">
          <NumField label={sel.kind === "piece" ? "Move →" : "Left"} value={look.x} placeholder={0} min={-3000} max={3000} onLive={(v) => apply({ x: v }, "live")} />
          <NumField label={sel.kind === "piece" ? "Move ↓" : "Top"} value={look.y} placeholder={0} min={-6000} max={20000} onLive={(v) => apply({ y: v }, "live")} />
          <NumField label="Width" value={look.w} placeholder={rect?.width} min={4} max={3000} onLive={(v) => apply({ w: v }, "live")} />
          <NumField label="Height" value={look.h} placeholder={rect?.height} min={4} max={6000} onLive={(v) => apply({ h: v }, "live")} />
          <NumField label="Turn °" value={look.rotate} placeholder={0} min={-360} max={360} onLive={(v) => apply({ rotate: v || undefined }, "live")} />
        </div>
        <div className="pd-row pd-wrap">
          <button type="button" onClick={() => apply({ z: (look.z ?? (added ? 0 : 1)) + 1 })}>Bring forward</button>
          <button type="button" onClick={() => apply({ z: (look.z ?? (added ? 0 : 1)) - 1 })}>Send backward</button>
          {added && (
            <button type="button" onClick={() => apply({ layer: added.layer === "back" ? "front" : "back" })}>
              {added.layer === "back" ? "Move in front of the page" : "Move behind the page (background)"}
            </button>
          )}
        </div>
        {added && (
          <label className="pd-field">
            <span>Link (optional)</span>
            <input type="text" placeholder="/family/joanne or https://…" value={added.href ?? ""} onFocus={() => designStore.checkpoint()} onChange={(e) => apply({ href: e.target.value.trim() || undefined }, "live")} />
          </label>
        )}
      </details>

      <div className="pd-row pd-wrap pd-foot">
        {sel.kind === "piece" && <button type="button" onClick={() => { const items = { ...design.items }; delete items[sel.key]; commit({ ...design, items }); }} title="Undo every change to this piece">Reset this piece</button>}
      </div>
    </div>
  );
}

function PagePanel({ personPage, design, commit, onPicture, onCopy, onVersions, onDefault, onShow, selected }: {
  personPage: boolean; design: Design; commit: (d: Design) => void; onPicture: () => void; onCopy: () => void; onVersions: () => void; onDefault: () => void; onShow: (key: string) => void; selected: boolean;
}) {
  const page = design.page;
  const setPage = (patch: Partial<Design["page"]>, live = false) => {
    const next = { ...page, ...patch };
    for (const k of Object.keys(next) as (keyof typeof next)[]) if (next[k] === undefined) delete next[k];
    const d = { ...design, page: next };
    if (live) designStore.live(d);
    else commit(d);
  };
  const hidden = Object.entries(design.items).filter(([, l]) => l.hidden).map(([k]) => k);
  return (
    <div className="pd-sections">
      <div className="pd-head">
        <strong>{selected ? "This page" : "Nothing selected"}</strong>
        {!selected && <span className="pd-hint">Click anything on the page to change it. Drag to move it, pull a corner to resize. Empty space selects the page.</span>}
      </div>
      <details open className="pd-sec">
        <summary>Background</summary>
        <ColorField label="Page color" value={page.color} fallback="#ffffff" onLive={(v) => setPage({ color: v }, true)} onReset={() => setPage({ color: undefined })} />
        {/* a person's page has ONE background, kept on their Snackbox entry (Page background + Background strength),
            so editors never end up with two pictures where the Snackbox one seems to "not work" */}
        {personPage ? (
          <p className="pd-hint">
            This person&apos;s background picture is set in Snackbox: open their entry and change <strong>Page background</strong> and <strong>Background strength (%)</strong>.
            {page.image && <> <button type="button" onClick={() => setPage({ image: undefined, imageFit: undefined, imageOpacity: undefined })}>Remove the old Design background</button></>}
          </p>
        ) : (
          <div className="pd-row pd-wrap">
            <button type="button" onClick={onPicture}>{page.image ? "Change background picture" : "Background picture…"}</button>
            {page.image && <button type="button" onClick={() => setPage({ image: undefined, imageFit: undefined, imageOpacity: undefined })}>Remove</button>}
          </div>
        )}
        {page.image && !personPage && (
          <>
            <div className="pd-row">
              <select value={page.imageFit ?? "cover"} onChange={(e) => setPage({ imageFit: e.target.value as "cover" | "contain" | "tile" })} aria-label="Background fit">
                <option value="cover">Fill the page</option>
                <option value="contain">Whole picture</option>
                <option value="tile">Repeat (tiles)</option>
              </select>
            </div>
            <label className="pd-range">
              <span>Strength</span>
              <input type="range" min={0} max={100} value={page.imageOpacity ?? 100} onPointerDown={() => designStore.checkpoint()} onChange={(e) => setPage({ imageOpacity: Number(e.target.value) }, true)} />
            </label>
          </>
        )}
        <ColorField label="Around the page" value={page.surround} fallback="#b5b5b5" onLive={(v) => setPage({ surround: v }, true)} onReset={() => setPage({ surround: undefined })} />
        <p className="pd-hint">To add pictures or shapes behind everything: add them, then “Move behind the page”. The artwork behind the page is its own piece: click it to fade, move or delete it.</p>
      </details>
      {hidden.length > 0 && (
        <details open className="pd-sec">
          <summary>Deleted pieces ({hidden.length})</summary>
          {hidden.map((key) => (
            <div key={key} className="pd-row">
              <span className="pd-lab pd-grow">{pieceLabel(pieceEl(key), key)}</span>
              <button type="button" className="pd-mini" onClick={() => onShow(key)}>Bring back</button>
            </div>
          ))}
        </details>
      )}
      <details open className="pd-sec">
        <summary>Whole page</summary>
        <div className="pd-col">
          <button type="button" onClick={onCopy}>Copy this design to other pages…</button>
          <button type="button" onClick={onVersions}>Earlier saved versions…</button>
          <button type="button" onClick={onDefault} disabled={isEmptyDesign(design)}>Default format (start over)</button>
        </div>
      </details>
    </div>
  );
}

/* ================= dialogs ================= */

let libraryCache: Promise<Library> | null = null;
const loadLibrary = () =>
  (libraryCache ??= fetch("/api/design/library").then(async (r) => {
    if (!r.ok) {
      libraryCache = null;
      throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Could not load the family pictures.");
    }
    return (await r.json()) as Library;
  }));

function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="pd-ui pd-modal" role="dialog" aria-modal aria-label={title}>
      <div className={wide ? "pd-dialog pd-dialog-wide" : "pd-dialog"}>
        <div className="pd-dialog-head">
          <strong>{title}</strong>
          <button type="button" className="pd-mini" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PicturePicker({ onPick, onClose }: { onPick: (p: Picked) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"family" | "computer" | "web">("family");
  const [lib, setLib] = useState<Library | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [untagged, setUntagged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => {
    loadLibrary().then(setLib, (e: Error) => setErr(e.message));
  }, []);
  const matches = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (lib?.pictures ?? [])
      .filter((p) => !untagged || !p.p.length)
      .filter((p) => {
        const text = `${p.t} ${p.p.join(" ")}`.toLowerCase();
        return words.every((w) => text.includes(w));
      })
      .slice(0, 150);
  }, [lib, q, untagged]);
  const untaggedCount = useMemo(() => (lib?.pictures ?? []).filter((p) => !p.p.length).length, [lib]);
  const fromComputer = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      onPick(await upload(file));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const fromWeb = () => {
    const u = url.trim();
    if (!/^https:\/\/\S+$/.test(u)) return setErr("Paste a picture address that starts with https://");
    const probe = new Image();
    probe.onload = () => onPick({ src: u, w: probe.naturalWidth, h: probe.naturalHeight });
    probe.onerror = () => setErr("That address did not load as a picture.");
    probe.src = u;
  };
  return (
    <Dialog title="Choose a picture" onClose={onClose} wide>
      <div className="pd-tabs">
        <button type="button" aria-pressed={tab === "family"} onClick={() => setTab("family")}>Family photos</button>
        <button type="button" aria-pressed={tab === "computer"} onClick={() => setTab("computer")}>From my computer</button>
        <button type="button" aria-pressed={tab === "web"} onClick={() => setTab("web")}>Web address</button>
      </div>
      {err && <p className="pd-msg pd-err">{err}</p>}
      {tab === "family" && (
        <>
          <input className="pd-search" type="search" placeholder="Search by who is in it or by title…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          {lib && (
            <label className="pd-check">
              <input type="checkbox" checked={untagged} onChange={(e) => setUntagged(e.target.checked)} /> Only photos with no one tagged ({untaggedCount})
            </label>
          )}
          {!lib && !err && <p className="pd-hint">Loading pictures…</p>}
          <div className="pd-grid">
            {matches.map((p) => (
              <button key={p.u} type="button" className="pd-thumb" title={p.p.length ? `${p.t}\nTagged: ${p.p.join(", ")}` : `${p.t}\nNo one tagged`} onClick={() => onPick({ src: p.u, srcset: p.s, w: p.w, h: p.h, alt: p.t })}>
                {/* eslint-disable-next-line @next/next/no-img-element -- CMS thumbnail */}
                <img src={p.u} alt="" loading="lazy" />
                <span>{p.t}</span>
                <span className={p.p.length ? "pd-thumb-tags" : "pd-thumb-tags pd-thumb-none"}>{p.p.length ? p.p.join(", ") : "No one tagged"}</span>
              </button>
            ))}
          </div>
          {lib && matches.length === 150 && <p className="pd-hint">Showing the first 150 — type more of a name to narrow it down.</p>}
        </>
      )}
      {tab === "computer" && (
        <div className="pd-col">
          <p className="pd-hint">The picture is added to the Snackbox media library, then placed on the page. Big photos are made smaller first.</p>
          <input type="file" accept={PHOTO_ACCEPT} disabled={busy} onChange={(e) => fromComputer(e.target.files?.[0])} />
          {busy && <p className="pd-hint">Uploading…</p>}
          <p className="pd-hint">Tip: you can also copy a picture anywhere and press Ctrl+V on the page.</p>
        </div>
      )}
      {tab === "web" && (
        <div className="pd-col">
          <input className="pd-search" type="url" placeholder="https://…/picture.jpg" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="button" className="pd-primary" onClick={fromWeb}>Use this picture</button>
        </div>
      )}
    </Dialog>
  );
}

function CopyToPages({ path, onClose }: { path: string; onClose: () => void }) {
  const [lib, setLib] = useState<Library | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ err?: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    loadLibrary().then(setLib, (e: Error) => setMsg({ err: true, text: e.message }));
  }, []);
  const groups = useMemo(() => {
    const m = new Map<string, Library["pages"]>();
    for (const p of lib?.pages ?? []) if (p.path !== path) m.set(p.group, [...(m.get(p.group) ?? []), p]);
    return [...m.entries()];
  }, [lib, path]);
  const toggle = (p: string) => setPicked((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  const toggleGroup = (list: Library["pages"]) => setPicked((s) => {
    const n = new Set(s);
    const all = list.every((p) => n.has(p.path));
    list.forEach((p) => (all ? n.delete(p.path) : n.add(p.path)));
    return n;
  });
  const go = async () => {
    if (!picked.size) return;
    if (!window.confirm(`Give ${picked.size} page${picked.size > 1 ? "s" : ""} this page's design?\n\nTheir current designs are replaced (they stay in each page's Earlier saved versions). Pieces that page does not have are skipped.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/design", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ copyTo: [...picked], design: designStore.get().design }) });
      const out = (await res.json().catch(() => ({}))) as { error?: string; saved?: number };
      if (!res.ok) throw new Error(out.error ?? `Copy failed (${res.status})`);
      setMsg({ text: `Done: ${out.saved} page${out.saved === 1 ? "" : "s"} now have this design.` });
      setPicked(new Set());
    } catch (e) {
      setMsg({ err: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="Copy this design to other pages" onClose={onClose} wide>
      <p className="pd-hint">Copies everything on this page&apos;s design — moves, sizes, fonts, colors, background, and the things you added — including changes you have not saved yet. The words and photos on each page stay their own.</p>
      {msg && <p className={msg.err ? "pd-msg pd-err" : "pd-msg pd-ok"}>{msg.text}</p>}
      {!lib && !msg && <p className="pd-hint">Loading pages…</p>}
      <div className="pd-pages">
        {groups.map(([group, list]) => (
          <fieldset key={group}>
            <legend>
              <label className="pd-check"><input type="checkbox" checked={list.every((p) => picked.has(p.path))} onChange={() => toggleGroup(list)} /> {group} (all {list.length})</label>
            </legend>
            {list.map((p) => (
              <label key={p.path} className="pd-check">
                <input type="checkbox" checked={picked.has(p.path)} onChange={() => toggle(p.path)} /> {p.title}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="pd-row pd-end">
        <button type="button" onClick={onClose}>Close</button>
        <button type="button" className="pd-primary" disabled={!picked.size || busy} onClick={go}>{busy ? "Copying…" : `Copy to ${picked.size || ""} page${picked.size === 1 ? "" : "s"}`}</button>
      </div>
    </Dialog>
  );
}

function Versions({ path, onLoad, onClose }: { path: string; onLoad: (d: Design | null) => void; onClose: () => void }) {
  const [list, setList] = useState<{ at: string; design: Design | null }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/design?path=${encodeURIComponent(path)}`)
      .then(async (r) => {
        const out = (await r.json().catch(() => ({}))) as { history?: { at: string; design: Design | null }[]; error?: string };
        if (!r.ok) throw new Error(out.error ?? "Could not load earlier versions.");
        setList(out.history ?? []);
      })
      .catch((e: Error) => setErr(e.message));
  }, [path]);
  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <Dialog title="Earlier saved versions" onClose={onClose}>
      <p className="pd-hint">Each Save keeps the version before it (the last 10). Loading one puts it on the page; press Save to keep it.</p>
      {err && <p className="pd-msg pd-err">{err}</p>}
      {list && !list.length && <p className="pd-hint">No earlier versions yet.</p>}
      <div className="pd-col">
        {list?.map((v, i) => (
          <div key={v.at + i} className="pd-row">
            <span className="pd-grow">Saved before {fmt(v.at)}{!v.design ? " (default format)" : ""}</span>
            <button type="button" className="pd-mini" onClick={() => onLoad(v.design ? cleanDesign(v.design) : null)}>Load</button>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
