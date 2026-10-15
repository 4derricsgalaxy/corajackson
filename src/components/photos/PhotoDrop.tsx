"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { failText, plainError, sendForm } from "@/lib/net";
import { HeicDecodeError, MAX_RAW_BYTES, PHOTO_ACCEPT, isHeicFile, looksLikePicture, preparePhoto, titleFromFileName } from "@/lib/photos/prepare";

/**
 * Edit mode only. Drop photos anywhere on a person's page (or a family's Gallery album), or press
 * "Add photos": each picture is turned upright, converted from iPhone HEIC if needed, shrunk, uploaded and
 * saved as a published Photos entry tagged with that person / filed in that album.
 */
export type PhotoTarget =
  | { kind: "person"; id: string; name: string; first: string }
  | { kind: "line"; id: string; name: string };

type Status = "waiting" | "converting" | "uploading" | "done" | "error";
type Item = { key: string; name: string; status: Status; message?: string; thumb?: string; draft?: boolean };

/** fingerprint of the original file + the page it is added to (undefined if this browser can't make one) */
async function photoKey(file: File, targetId: string): Promise<string | undefined> {
  try {
    const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
    const fileHash = hex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
    return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${targetId}:${fileHash}`))).slice(0, 24);
  } catch {
    return undefined;
  }
}

const STATUS_TEXT: Record<Status, string> = {
  waiting: "Waiting…",
  converting: "Getting it ready…",
  uploading: "Uploading…",
  done: "Added",
  error: "Not added",
};

export function PhotoDrop({ target }: { target: PhotoTarget }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const where = target.kind === "person" ? `${target.first}'s Memories` : `the ${target.name} album`;

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  // photos picked or dropped while others are still uploading wait their turn (never silently ignored)
  const queue = useRef<(Item & { file: File })[]>([]);
  const running = useRef(false);

  const addOne = useCallback(
    async (it: Item & { file: File }): Promise<boolean> => {
      const { file, key } = it;
      if (!looksLikePicture(file)) {
        update(key, { status: "error", message: "This isn't a picture." });
        return false;
      }
      try {
        update(key, { status: "converting" });
        const fingerprint = await photoKey(file, target.id);
        let body: Blob;
        let name: string;
        try {
          const prepared = await preparePhoto(file);
          body = prepared.blob;
          name = prepared.name;
        } catch (err) {
          // the browser couldn't read an iPhone photo: let the website convert the original instead
          if (err instanceof HeicDecodeError || (await isHeicFile(file))) {
            if (file.size > MAX_RAW_BYTES) throw new Error("This iPhone photo is too big to convert here. Save it as a JPG and try again.");
            body = file;
            name = /\.hei[cf]$/i.test(file.name) ? file.name : `${file.name || "photo"}.heic`;
          } else throw err;
        }
        update(key, { status: "uploading", thumb: body.type === "image/jpeg" ? URL.createObjectURL(body) : undefined });
        const form = new FormData();
        form.set("file", body, name);
        form.set(target.kind === "person" ? "person" : "line", target.id);
        if (fingerprint) form.set("key", fingerprint);
        const title = titleFromFileName(file.name);
        if (title) form.set("title", title);
        // a timeout or a busy server is retried once: with the fingerprint that can never make a second copy
        let res: Response | undefined;
        let lastErr: unknown;
        for (let attempt = 0; attempt < (fingerprint ? 2 : 1) && !res?.ok; attempt++) {
          if (attempt) await new Promise((r) => setTimeout(r, 2500));
          try {
            res = await sendForm("/api/photos/add", form);
            if (res.status < 500) break;
          } catch (err) {
            lastErr = err;
            res = undefined;
          }
        }
        if (!res) throw new Error(plainError(lastErr, "add this photo"));
        const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; live?: boolean; title?: string; already?: boolean };
        if (!res.ok || !out.ok) throw new Error(out.error ?? failText(res.status, "add this photo"));
        update(key, {
          status: "done",
          draft: out.live === false,
          message: out.already
            ? `Already in ${where} — not added twice.`
            : out.live === false
              ? "Saved, but not yet on the site: open Photos in Snackbox and press Publish."
              : out.title,
        });
        return !out.already;
      } catch (err) {
        update(key, { status: "error", message: (err as Error).message || "Something went wrong." });
        return false;
      }
    },
    [target, where],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const stamp = Date.now();
      const batch: (Item & { file: File })[] = files.map((file, i) => ({ key: `${stamp}-${i}`, name: file.name || "photo", status: "waiting", file }));
      // a new batch replaces a finished list; while photos are uploading it joins the end of the list
      setItems((list) => [...(running.current ? list : []), ...batch.map(({ key, name, status }) => ({ key, name, status }))]);
      queue.current.push(...batch);
      if (running.current) return;
      running.current = true;
      setBusy(true);
      let added = 0;
      for (let it = queue.current.shift(); it; it = queue.current.shift()) if (await addOne(it)) added++;
      running.current = false;
      setBusy(false);
      if (added) router.refresh();
    },
    [addOne, router],
  );

  // the whole window is the drop zone; only real files (not text or links dragged around the page) count
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current++;
      setOver(true);
    };
    const overHandler = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // allows the drop, and stops the browser from opening the picture instead
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setOver(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      void addFiles(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", enter, true);
    window.addEventListener("dragover", overHandler, true);
    window.addEventListener("dragleave", leave, true);
    window.addEventListener("drop", drop, true);
    return () => {
      window.removeEventListener("dragenter", enter, true);
      window.removeEventListener("dragover", overHandler, true);
      window.removeEventListener("dragleave", leave, true);
      window.removeEventListener("drop", drop, true);
    };
  }, [addFiles]);

  const finished = !busy && items.length > 0;
  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "error").length;

  return (
    <>
      <button type="button" className="pd-ui photo-add-launch" onClick={() => input.current?.click()} title={`Add photos to ${where}. You can also drag photos onto the page.`}>
        <span aria-hidden>＋</span> <strong>Add photos</strong>
      </button>
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void addFiles(files);
        }}
      />

      {over && (
        <div className="pd-ui photo-drop-zone" aria-hidden>
          <div>
            <strong>Drop to add to {where}</strong>
            <span>JPG, PNG or iPhone photos. You can drop several at once.</span>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="pd-ui photo-add-panel" role="status" aria-live="polite">
          <div className="photo-add-head">
            <strong>
              {busy ? `Adding photos to ${where}…` : `${done} of ${items.length} added to ${where}${failed ? ` (${failed} not added)` : ""}`}
            </strong>
            {finished && (
              <button type="button" onClick={() => { items.forEach((i) => i.thumb && URL.revokeObjectURL(i.thumb)); setItems([]); }} aria-label="Close">
                ✕
              </button>
            )}
          </div>
          <ul>
            {items.map((it) => (
              <li key={it.key} className={`photo-add-${it.status}${it.draft ? " photo-add-draft" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the picture being added */}
                {it.thumb ? <img src={it.thumb} alt="" /> : <span className="photo-add-thumb" aria-hidden />}
                <span>
                  <b title={it.name}>{it.name}</b>
                  <small>{it.message && (it.status === "done" || it.status === "error") ? it.message : STATUS_TEXT[it.status]}</small>
                </span>
              </li>
            ))}
          </ul>
          {finished && done > 0 && (
            <p className="photo-add-note">
              New photos are at the end of the {target.kind === "person" ? "Memories strip" : "album"}. To add more people, a caption or a year, open the photo in Snackbox → Photos.
            </p>
          )}
        </div>
      )}
    </>
  );
}
