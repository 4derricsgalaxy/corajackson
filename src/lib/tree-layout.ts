import { hierarchy, tree, type HierarchyPointNode } from "d3-hierarchy";
import type { TreeNode } from "./content/types";

export interface LaidOutNode {
  node: TreeNode;
  /** 3D position in scene units */
  position: [number, number, number];
  /** parent id for drawing branches */
  parentId: string | null;
  depth: number;
  /** angle around the trunk (radians) */
  theta: number;
  radius: number;
  lineIndex: number;
}

export interface TreeLayout {
  nodes: LaidOutNode[];
  byId: Map<string, LaidOutNode>;
  lineCount: number;
}

/**
 * Lays out the family as a radial canopy: Cora is the trunk base, each of her
 * children owns an angular sector, grandchildren and great-grandchildren fan
 * outwards and upwards inside that sector like branches and leaves.
 */
export function layoutFamilyTree(root: TreeNode): TreeLayout {
  const h = hierarchy<TreeNode>(root, (d) => d.children);
  const lineCount = Math.max(1, root.children.length);
  // d3 radial tree: x = angle, y = radius
  const layout = tree<TreeNode>()
    .size([Math.PI * 2, 1])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.6) / Math.max(1, a.depth));
  const pts = layout(h) as HierarchyPointNode<TreeNode>;

  const nodes: LaidOutNode[] = [];
  const byId = new Map<string, LaidOutNode>();
  const lineIndexOf = (n: HierarchyPointNode<TreeNode>): number => {
    let cur = n;
    while (cur.depth > 1 && cur.parent) cur = cur.parent;
    return cur.depth === 0 ? -1 : root.children.findIndex((c) => c._id === cur.data._id);
  };

  pts.each((p) => {
    const depth = p.depth;
    const theta = p.x - Math.PI / 2;
    // radius grows with depth; heights step up like canopy layers
    const radius = depth === 0 ? 0 : 3.2 + depth * 3.4 + (depth > 1 ? Math.sin(p.x * 7) * 0.6 : 0);
    const height = depth === 0 ? 0 : 3.4 + depth * 2.3 + (depth > 1 ? Math.cos(p.x * 5) * 0.7 : 0);
    const position: [number, number, number] = [Math.cos(theta) * radius, height, Math.sin(theta) * radius];
    const laid: LaidOutNode = {
      node: p.data,
      position,
      parentId: p.parent ? p.parent.data._id : null,
      depth,
      theta,
      radius,
      lineIndex: lineIndexOf(p),
    };
    nodes.push(laid);
    byId.set(p.data._id, laid);
  });

  return { nodes, byId, lineCount };
}

/** Distinct hue per family line, warm heirloom palette. */
export const LINE_COLORS = [
  "#d8a63a", // gold frame
  "#8a5a3a", // walnut frame
  "#5f9a48", // leaf green frame
  "#c8508f", // magenta frame
  "#c8433d", // red frame
  "#e0853a", // orange frame
  "#d98a8a", // rose frame
  "#3d95d1", // sky blue frame
  "#7b5c8a",
  "#3f7a6a",
];

export function lineColor(index: number, fallback?: string): string {
  if (fallback) return fallback;
  if (index < 0) return "#efe3c8";
  return LINE_COLORS[index % LINE_COLORS.length];
}
