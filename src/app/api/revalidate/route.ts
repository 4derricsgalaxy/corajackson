import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Snackbox revalidation contract. The CMS POSTs {paths, tags} here on publish
 * with the shared secret in a header; GET is the read-only readiness probe
 * that check_site_setup uses.
 */
function secretOk(req: Request) {
  const secret = req.headers.get("x-revalidation-secret") ?? req.headers.get("x-revalidate-secret");
  return Boolean(secret && process.env.REVALIDATION_SECRET && secret === process.env.REVALIDATION_SECRET);
}

export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!secretOk(req)) return NextResponse.json({ ok: false }, { status: 401, headers });
  return NextResponse.json({ ok: true, snackbox: { revalidate: 1, visualEditing: 1 } }, { headers });
}

export async function POST(req: Request) {
  if (!secretOk(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const { paths, tags } = (await req.json().catch(() => ({}))) as { paths?: string[]; tags?: string[] };
  for (const path of paths ?? []) revalidatePath(path);
  for (const tag of tags ?? []) revalidateTag(tag, { expire: 0 });
  // Everything on this site derives from the family graph, so a publish of any
  // document should refresh every page, not only the ones the CMS mapped.
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, revalidated: paths ?? [], tags: tags ?? [] });
}
