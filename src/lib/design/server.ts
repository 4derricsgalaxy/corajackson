import { cache } from "react";
import { site } from "@/lib/cms/client";
import { parseDesign, type Design } from "./model";

export const DESIGN_TYPE = "pageDesign";

type DesignDoc = { _id: string; title?: string; data?: string };

/** Every saved page design by page address (one cached read for the whole site). */
export const getDesigns = cache(async (): Promise<Map<string, Design>> => {
  const out = new Map<string, Design>();
  try {
    for (let offset = 0; offset < 5000; offset += 100) {
      const page = await site.query<DesignDoc>(DESIGN_TYPE).limit(100).offset(offset).find();
      for (const doc of page) {
        const design = parseDesign(doc.data);
        if (doc.title && design) out.set(doc.title, design);
      }
      if (page.length < 100) break;
    }
  } catch (err) {
    // no designs (or the CMS is unreachable): every page shows its built-in format
    console.warn("[design] could not load page designs:", (err as Error).message);
  }
  return out;
});

export async function getDesign(path: string): Promise<Design | undefined> {
  return (await getDesigns()).get(path);
}
