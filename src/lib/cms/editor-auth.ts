import { cookies, draftMode } from "next/headers";
import { NextResponse } from "next/server";

// Shared guard for the on-page edit tools (Layout, Crop). Only an editor who is signed in to on-site editing
// (draft mode + the overlay token cookie set by /api/snackbox-edit, re-checked against the CMS) gets through.
// Writes then use the server-side SNACKBOX_WRITE_TOKEN, which never reaches the browser.

const TOKEN_COOKIE = "sbx-edit-token";

export type EditorWrite = { api: string; project: string; auth: { Authorization: string }; /** who is signed in (from the edit session) */ email?: string };

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
    .then(async (r) => (r.ok ? ((await r.json()) as { ok?: boolean; email?: string }) : r.status === 401 || r.status === 403 ? { ok: false } : null))
    .catch(() => null);
  // Snackbox didn't answer (or had a hiccup): that is not a signed-out editor - nothing to sign in again for
  if (session === null) {
    return NextResponse.json({ error: `Snackbox didn't answer, so ${what} couldn't be saved. Try again in a moment (your changes are still on the page).` }, { status: 502 });
  }
  if (!session.ok) {
    return NextResponse.json({ error: "Your edit session has expired. Sign in to Snackbox again in a new tab and open this page from there, then try again." }, { status: 403 });
  }
  return { api: `${cms}/api/v1/${project}`, project, auth: { Authorization: `Bearer ${writeToken}` }, email: session.email?.trim().toLowerCase() || undefined };
}
