import { draftMode } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Edit-mode bootstrap for SnackBox on-site editing: overlay.js POSTs here
// (never a query-string token — those land in the site's request logs).
// We verify the overlay token against the CMS, enable Next draft mode, keep
// the token in an httpOnly cookie, and bounce back. action=exit turns it off.

/** Matches EDIT_TTL_MS on the CMS side (12h); an expired token just 403s. */
const TOKEN_COOKIE = "sbx-edit-token";
const TOKEN_MAX_AGE = 12 * 60 * 60;

function safeTarget(req: NextRequest, ret: string): URL {
  try {
    const target = new URL(ret, req.nextUrl.origin);
    if (target.origin !== req.nextUrl.origin) return new URL("/", req.nextUrl.origin);
    return target;
  } catch {
    return new URL("/", req.nextUrl.origin);
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const action = String(form.get("action") ?? "");

  if (action === "exit") {
    (await draftMode()).disable();
    const ret = String(form.get("return") ?? req.headers.get("referer") ?? "/");
    const res = NextResponse.redirect(safeTarget(req, ret), 303);
    res.cookies.set(TOKEN_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  }

  const token = String(form.get("token") ?? "");
  const ret = String(form.get("return") ?? "/");

  const cms = (process.env.NEXT_PUBLIC_SNACKBOX_URL ?? "").replace(/\/$/, "");
  const project = process.env.NEXT_PUBLIC_SNACKBOX_PROJECT ?? "";
  if (!cms || !project || !token) {
    return NextResponse.json({ error: "Edit mode is not configured" }, { status: 400 });
  }

  const session = await fetch(`${cms}/api/overlay/session?project=${encodeURIComponent(project)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  })
    .then(async (r) => {
      const text = await r.text();
      try {
        return JSON.parse(text) as { ok?: boolean };
      } catch {
        return null;
      }
    })
    .catch(() => null);
  if (!session?.ok) {
    return NextResponse.json({ error: "Not an editor session" }, { status: 403 });
  }

  (await draftMode()).enable();

  const res = NextResponse.redirect(safeTarget(req, ret), 303);
  res.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_MAX_AGE,
  });
  return res;
}


// Public verification is request scoped: it does not clear draft cookies shared
// by other tabs. proxy.ts marks only this verification request; ordinary traffic skips it.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("action") !== "public") {
    return NextResponse.json({ error: "Use POST to start editing" }, { status: 405 });
  }
  const target = safeTarget(req, req.nextUrl.searchParams.get("return") ?? "/");
  target.searchParams.set("sbx-public", "1");
  target.searchParams.delete("sbx-edit");
  return NextResponse.redirect(target, 303);
}
