"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cleanCrop, CROP_FIELDS, cropStyle, type ImageCrop } from "@/lib/content/crop";

/**
 * The crop window (edit mode only), opened by the Design tool with openCrop(img): the whole picture with a
 * crop box shaped like the frame it sits in. Drag the box to move it, drag a corner to size it (arrow keys
 * nudge, Shift = bigger steps). For a CMS picture "Save crop" writes the crop to that picture's field through
 * /api/image-crop and reloads; for a picture added with the Design tool it hands the crop back (onSave).
 * The frame then zooms into the cropped area (lib/content/crop.ts).
 */

type Target = {
  doc: string;
  field: string;
  src: string;
  sw: number;
  sh: number;
  frame: number;
  crop?: ImageCrop;
  label: string;
  onSave?: (crop: ImageCrop | null, size: { w: number; h: number }) => void;
};

const OPEN_EVENT = "pd-crop";
type OpenDetail = { img: HTMLImageElement; onSave?: Target["onSave"] };

/** Open the crop window for a picture; without onSave it must be a CMS picture (canCrop). */
export function openCrop(img: HTMLImageElement, onSave?: Target["onSave"]) {
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail: { img, onSave } }));
}

/** true when the picture's crop can be saved to its CMS field */
export const canCrop = (img: HTMLImageElement) => Boolean(targetOf(img));

const savedCrop = (img: HTMLImageElement) => {
  try {
    return cleanCrop(JSON.parse(img.getAttribute("data-crop") ?? "null"));
  } catch {
    return undefined;
  }
};
type Box = { x: number; y: number; w: number; h: number };
type Drag = { mode: "move" | "corner"; pointerId: number; sx: number; sy: number; start: Box; hx: 0 | 1; hy: 0 | 1 };

const MIN = 0.05;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** the CMS entry + field an <img> belongs to, when its picture can be cropped here */
function targetOf(img: HTMLImageElement): Target | null {
  const host = img.closest<HTMLElement>("[data-sbx-doc]");
  const doc = host?.getAttribute("data-sbx-doc");
  const field = host?.getAttribute("data-sbx-field") ?? "";
  if (!host || !doc || img.classList.contains("wix-canvas-art")) return null;
  if (field ? !CROP_FIELDS.includes(field) : !doc.startsWith("photo-")) return null;
  if (!/^https?:/.test(img.currentSrc || img.src)) return null;
  const r = img.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return null;
  const label = img.alt || host.getAttribute("aria-label") || "this picture";
  return { doc, field, src: largestSrc(img), sw: 0, sh: 0, frame: r.width / r.height, crop: savedCrop(img), label };
}

/** the biggest file in the <img>'s srcset (thumbnails may load a small one) */
export function largestSrc(img: HTMLImageElement): string {
  let best = img.currentSrc || img.src;
  let bestW = 0;
  for (const part of (img.getAttribute("srcset") ?? "").split(",")) {
    const [url, w] = part.trim().split(/\s+/);
    const n = parseInt(w ?? "", 10);
    if (url && n > bestW) { best = url; bestW = n; }
  }
  return best;
}

/** where the crop box starts: the saved crop, else the part of the picture the frame shows now (centered) */
function startBox(t: Target): Box {
  if (t.crop) return { x: t.crop.left, y: t.crop.top, w: t.crop.width, h: t.crop.height };
  const sa = t.sw / t.sh;
  const h = Math.min(1, sa / t.frame);
  const w = (h * t.frame) / sa;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/** the whole picture, as large as fits the dialog (the crop box math needs the true shape) */
function stageSize(t: Target) {
  const narrow = window.innerWidth <= 640;
  const maxW = Math.min(640, window.innerWidth - (narrow ? 64 : 230));
  const maxH = Math.min(640, window.innerHeight * (narrow ? 0.55 : 0.7));
  const s = Math.min(maxW / t.sw, maxH / t.sh);
  return { width: Math.round(t.sw * s), height: Math.round(t.sh * s) };
}

export function CropDialog() {
  const [target, setTarget] = useState<Target | null>(null);
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 1, h: 1 });
  const [free, setFree] = useState(false); // false = the box keeps the frame's shape
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "error"; text?: string }>({ kind: "idle" });
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  // openCrop(img): load the whole picture first, its true size drives the crop box
  useEffect(() => {
    const onOpen = (e: Event) => {
      const { img, onSave } = (e as CustomEvent<OpenDetail>).detail;
      const r = img.getBoundingClientRect();
      const t: Target | null = onSave
        ? { doc: "", field: "", src: largestSrc(img), sw: 0, sh: 0, frame: r.width / Math.max(1, r.height), crop: savedCrop(img), label: img.alt || "this picture", onSave }
        : targetOf(img);
      if (!t) return;
      const full = new Image();
      full.onload = () => {
        const ready = { ...t, sw: full.naturalWidth, sh: full.naturalHeight };
        setTarget(ready);
        setBox(startBox(ready));
        setFree(Boolean(t.crop && Math.abs((t.crop.width * ready.sw) / (t.crop.height * ready.sh) - t.frame) > 0.02));
        setStatus({ kind: "idle" });
      };
      full.onerror = () => window.alert("Could not load that picture.");
      full.src = t.src;
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // width → height for the frame's shape (fractions of the picture)
  const lockH = useCallback((w: number) => (target ? (w * (target.sw / target.sh)) / target.frame : w), [target]);

  // the crop dialog swallows page clicks too, and Escape closes it
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setTarget(null); return; }
      if ((e.target as HTMLElement | null)?.closest?.("input, select, textarea")) return;
      const step = e.shiftKey ? 0.05 : 0.005;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d) return;
      e.preventDefault();
      setBox((b) => ({ ...b, x: clamp(b.x + d[0], 0, 1 - b.w), y: clamp(b.y + d[1], 0, 1 - b.h) }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target]);

  const frac = (e: { clientX: number; clientY: number }) => {
    const r = stage.current!.getBoundingClientRect();
    return { px: (e.clientX - r.left) / r.width, py: (e.clientY - r.top) / r.height };
  };

  const onDown = (e: ReactPointerEvent, mode: Drag["mode"], hx: 0 | 1 = 0, hy: 0 | 1 = 0) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const { px, py } = frac(e);
    drag.current = { mode, pointerId: e.pointerId, sx: px, sy: py, start: box, hx, hy };
  };

  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const { px, py } = frac(e);
    const s = d.start;
    if (d.mode === "move") {
      setBox({ ...s, x: clamp(s.x + px - d.sx, 0, 1 - s.w), y: clamp(s.y + py - d.sy, 0, 1 - s.h) });
      return;
    }
    // corner: the opposite corner stays put
    const ax = d.hx ? s.x : s.x + s.w;
    const ay = d.hy ? s.y : s.y + s.h;
    const roomW = d.hx ? 1 - ax : ax;
    const roomH = d.hy ? 1 - ay : ay;
    let w: number;
    let h: number;
    if (free) {
      w = clamp(Math.abs(clamp(px, 0, 1) - ax), MIN, roomW);
      h = clamp(Math.abs(clamp(py, 0, 1) - ay), MIN, roomH);
    } else {
      const k = lockH(1); // h per unit of w
      w = Math.max(Math.abs(px - ax), Math.abs(py - ay) / k);
      w = clamp(w, MIN, Math.min(roomW, roomH / k));
      h = w * k;
    }
    setBox({ x: d.hx ? ax : ax - w, y: d.hy ? ay : ay - h, w, h });
  };

  const onUp = (e: ReactPointerEvent) => {
    if (drag.current?.pointerId === e.pointerId) drag.current = null;
  };

  const toggleFree = () => {
    if (free) {
      // back to the frame's shape: keep the center, fit inside the picture
      setBox((b) => {
        const k = lockH(1);
        const w = Math.min(b.w, b.h / k, 1, 1 / k);
        const h = w * k;
        return { w, h, x: clamp(b.x + (b.w - w) / 2, 0, 1 - w), y: clamp(b.y + (b.h - h) / 2, 0, 1 - h) };
      });
    }
    setFree(!free);
  };

  const save = async (crop: ImageCrop | null) => {
    if (!target) return;
    if (target.onSave) {
      target.onSave(crop, { w: target.sw, h: target.sh });
      setTarget(null);
      return;
    }
    setStatus({ kind: "saving", text: "Saving…" });
    try {
      const res = await fetch("/api/image-crop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: target.doc, field: target.field, crop }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(out.error ?? `Save failed (${res.status})`);
      window.location.reload();
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
  };

  if (!target) return null;

  const whole = box.w > 0.995 && box.h > 0.995;
  const crop: ImageCrop = { left: box.x, top: box.y, width: box.w, height: box.h };
  const previewW = 140;
  const preview = cropStyle({ crop, width: target.sw, height: target.sh }, target.frame);
  const pct = (n: number) => `${n * 100}%`;
  const corners: [0 | 1, 0 | 1][] = [[0, 0], [1, 0], [0, 1], [1, 1]];

  return (
    <div className="ic-modal" role="dialog" aria-modal aria-label={`Crop ${target.label}`}>
      <div className="ic-panel">
        <div className="ic-head">
          <strong>Crop: {target.label}</strong>
          <span>Drag the box to move it. Drag a corner to make it bigger or smaller.</span>
        </div>
        <div className="ic-body">
          <div
            ref={stage}
            className="ic-stage"
            style={stageSize(target)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the same CMS picture, shown whole */}
            <img src={target.src} alt="" draggable={false} />
            <div
              className="ic-box"
              style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) }}
              onPointerDown={(e) => onDown(e, "move")}
            >
              {corners.map(([hx, hy]) => (
                <span
                  key={`${hx}${hy}`}
                  className="ic-handle"
                  style={{ left: `calc(${pct(hx)} - ${hx * 18}px)`, top: `calc(${pct(hy)} - ${hy * 18}px)`, cursor: hx === hy ? "nwse-resize" : "nesw-resize" }}
                  onPointerDown={(e) => onDown(e, "corner", hx, hy)}
                />
              ))}
            </div>
          </div>
          <div className="ic-side">
            <span className="ic-label">How it will look</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- live preview of the frame */}
            <img
              className="ic-preview"
              src={target.src}
              alt=""
              width={previewW}
              height={Math.round(previewW / target.frame)}
              style={preview ?? { objectFit: "cover" }}
            />
            <label className="ic-free">
              <input type="checkbox" checked={free} onChange={toggleFree} /> Any shape
            </label>
            <button type="button" onClick={() => setBox(startBox({ ...target, crop: undefined }))}>Start over</button>
          </div>
        </div>
        <div className="ic-foot">
          {status.text && <span className={status.kind === "error" ? "tl-msg tl-err" : "tl-msg"}>{status.text}</span>}
          {target.crop && (
            <button type="button" disabled={status.kind === "saving"} onClick={() => save(null)} title="Show the whole picture again">
              Remove crop
            </button>
          )}
          <button type="button" onClick={() => setTarget(null)}>Cancel</button>
          <button type="button" className="tl-save" disabled={status.kind === "saving" || whole} onClick={() => save(crop)}>
            Save crop
          </button>
        </div>
      </div>
    </div>
  );
}
