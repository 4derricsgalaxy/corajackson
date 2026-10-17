import type { EditorWrite } from "@/lib/cms/editor-auth";

// Server side of a picture upload from the on-page tools: one file from the browser -> one Snackbox media asset.
// The browser normally sends an upright JPEG it already made (lib/photos/prepare.ts); when it could not read an
// iPhone HEIC photo it sends the original, which is converted here.

/** Vercel caps a request at 4.5 MB */
export const MAX_PICTURE_BYTES = 4_400_000;

export type Uploaded = { ok: true; id: string; url?: string; width?: number; height?: number } | { ok: false; status: number; error: string };

const isHeic = (f: File) => /^image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);

export async function uploadPicture(editor: EditorWrite, file: File, alt: string): Promise<Uploaded> {
  if (file.size > MAX_PICTURE_BYTES) return { ok: false, status: 413, error: "That picture is too big (over 4 MB)." };
  let upload: Blob = file;
  let uploadName = file.name || "photo.jpg";
  if (isHeic(file)) {
    try {
      const { default: convert } = await import("heic-convert");
      const jpeg = await convert({ buffer: new Uint8Array(await file.arrayBuffer()), format: "JPEG", quality: 0.88 });
      upload = new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" });
      uploadName = uploadName.replace(/\.hei[cf]$/i, "") + ".jpg";
    } catch {
      return { ok: false, status: 422, error: "Couldn't read this iPhone photo. Save it as a JPG and try again." };
    }
  } else if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    return { ok: false, status: 415, error: "Use a JPG, PNG or iPhone (HEIC) photo." };
  }

  const out = new FormData();
  out.set("file", upload, uploadName);
  out.set("alt", alt.slice(0, 300));
  const asset = await fetch(`${editor.api}/assets`, { method: "POST", headers: editor.auth, body: out, cache: "no-store" })
    .then(async (r) => ({ ok: r.ok, status: r.status, json: (await r.json().catch(() => null)) as { result?: { id?: string; url?: string; width?: number | null; height?: number | null } } | null }))
    .catch(() => ({ ok: false, status: 0, json: null }));
  const id = asset.json?.result?.id;
  if (!asset.ok || !id) return { ok: false, status: 502, error: `Snackbox did not accept the picture (${asset.status || "no answer"}).` };
  const { url, width, height } = asset.json?.result ?? {};
  return { ok: true, id, url, ...(width && height ? { width, height } : {}) };
}
