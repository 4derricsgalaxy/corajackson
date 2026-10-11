import { cookies, draftMode } from "next/headers";
import { NextResponse } from "next/server";

// Shared guard for the on-page edit tools (Layout, Crop). Only an editor who is signed in to on-site editing
// (draft mode + the overlay token cookie set by /api/snackbox-edit, re-checked against the CMS) gets through.
// Writes then use the server-side SNACKBOX_WRITE_TOKEN, which never reaches the browser.

const TOKEN_COOKIE = "sbx-edit-token";

export type EditorWrite = { api: string; project: string; auth: { Authorization: string } };

/** The CMS write endpoint + auth for a verified editor, or the error response to send back. */
export async function requireEditor(what: string): Promise<EditorWrite | NextResponse> {
  const cms = (process.env.NEXT_PUBLIC_SNACKBOX_URL ?? "").replace(/\/$/, "");
  const project = process.env.NEXT_PUBLIC_SNACKBOX_PROJECT ?? "";
  const writeToken = process.env.SNACKBOX_WRITE_TOKEN ?? "";
  if (!cms || !project || !writeToken) {
    return NextResponse.json({ error: `Saving ${what} is not set up on this site yet (SNACKBOX_WRITE_TOKEN is missing).` }, { status: 503 });
  }

  const editToken = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!(await draftMode()).isEnabled || !editToken) {
    return NextResponse.json({ error: "Open the page in Snackbox edit mode first." }, { status: 401 });
  }
  const session = await fetch(`${cms}/api/overlay/session?project=${encodeURIComponent(project)}`, {
    headers: { Authorization: `Bearer ${editToken}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  })
    .then((r) => (r.ok ? (r.json() as Promise<{ ok?: boolean }>) : null))
    .catch(() => null);
  if (!session?.ok) {
    return NextResponse.json({ error: "Your edit session has expired. Reopen the page from Snackbox and try again." }, { status: 403 });
  }
  return { api: `${cms}/api/v1/${project}`, project, auth: { Authorization: `Bearer ${writeToken}` } };
}
