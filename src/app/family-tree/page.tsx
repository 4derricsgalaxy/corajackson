import type { Metadata } from "next";
import { FamilyTreeExplorer } from "@/components/tree/FamilyTreeExplorer";
import { getFamilyGraph } from "@/lib/content/queries";
import { buildScene } from "@/lib/scene";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Family Tree", description: "An interactive tree of Cora Mae Jackson's descendants." };

export default async function FamilyTreePage() {
  const graph = await getFamilyGraph();
  const { nodes, lines } = buildScene(graph);
  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-16 pt-6 md:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">The living tree</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">{graph.all.length} people, one root.</h1>
        </div>
        <p className="max-w-md text-sm text-ink-3">Rendered with WebGL from the family CMS. When someone adds a person or a portrait in the CMS, a new leaf grows here.</p>
      </div>
      <FamilyTreeExplorer nodes={nodes} lines={lines} />
    </div>
  );
}
