import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/cms/editor-auth";

// Design tool: a picture from the editor's computer goes into the Snackbox media library, and the page
// design points at it. The browser shrinks big pictures first (Vercel caps a request at 4.5 MB).

const MAX_BYTES = 4_400_000;

export async function POST(req: NextRequest) {
  const editor = await requireEditor("pictures");
  if (editor instanceof NextResponse) return editor;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    return NextResponse.json({ error: "Choose a JPG, PNG, WebP or GIF picture." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That picture is too big (over 4 MB)." }, { status: 413 });

  const out = new FormData();
  out.set("file", file, file.name || "picture");
  const alt = form?.get("alt");
  if (typeof alt === "string" && alt) out.set("alt", alt.slice(0, 300));
  const res = await fetch(`${editor.api}/assets`, { method: "POST", headers: editor.auth, body: out, cache: "no-store" });
  const json = (await res.json().catch(() => null)) as { result?: { id?: string; url?: string; srcset?: string; width?: number | null; height?: number | null } } | null;
  if (!res.ok || !json?.result?.url) {
    return NextResponse.json({ error: `Snackbox did not accept the picture (${res.status}).` }, { status: 502 });
  }
  const { id, url, srcset, width, height } = json.result;
  return NextResponse.json({ id, url, srcset: srcset || undefined, width: width ?? null, height: height ?? null });
}
