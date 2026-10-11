import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/cms/editor-auth";
import { mayChange, pageAccess } from "@/lib/cms/page-access";
import { PATH_RE } from "@/lib/design/model";

// GET ?path=/family/keith -> { canEdit, own } — asked by the Design tool when it opens, so a family member
// on someone else's page is told right away (the save route checks again).
export async function GET(req: NextRequest) {
  const editor = await requireEditor("designs");
  if (editor instanceof NextResponse) return editor;
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!PATH_RE.test(path)) return NextResponse.json({ error: "Bad page address." }, { status: 400 });
  try {
    const access = await pageAccess(editor.email);
    return NextResponse.json({ canEdit: mayChange(access, path), own: access.all ? undefined : access.pages[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
