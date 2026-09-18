import type { SceneLine, SceneNode } from "@/components/tree/types";
import { layoutFamilyTree, lineColor } from "./tree-layout";
import type { FamilyGraph } from "./content/queries";

/** Build the serializable scene payload for the 3D/2D tree from the family graph. */
export function buildScene(graph: FamilyGraph): { nodes: SceneNode[]; lines: SceneLine[] } {
  if (!graph.root) return { nodes: [], lines: [] };
  const layout = layoutFamilyTree(graph.root);
  const lines: SceneLine[] = graph.lines.map((l, i) => ({ index: i, slug: l.slug, title: l.nickname ?? l.title.split(" ")[0], color: lineColor(i, l.accentColor) }));
  const nodes: SceneNode[] = layout.nodes.map((n) => ({
    id: n.node._id,
    slug: n.node.slug,
    title: n.node.title,
    nickname: n.node.nickname,
    shortBio: n.node.shortBio,
    portrait: n.node.portrait,
    generation: n.depth,
    parentId: n.parentId,
    lineIndex: n.lineIndex,
    lineSlug: n.node.lineSlug,
    color: n.depth === 0 ? "#c39a4a" : lineColor(n.lineIndex, graph.lines[n.lineIndex]?.accentColor),
    position: n.position,
    childCount: n.node.children.length,
    birthDate: n.node.birthDate,
    deathDate: n.node.deathDate,
  }));
  return { nodes, lines };
}
