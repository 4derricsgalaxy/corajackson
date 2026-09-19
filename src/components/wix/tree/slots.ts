import type { TreeNode } from "@/lib/content/types";

/**
 * The eight photo-frame positions of the original Wix "Family Tree" page, measured on its
 * 744 × 850 canvas. `frame` is the coloured rounded box, `photo` is the picture inside it
 * (offset relative to the frame). `slug` is who sat there originally; it is only used to keep
 * people in their familiar spot — anyone else from the CMS simply takes the next free slot.
 */
export interface TreeSlot {
  slug: string;
  color: string;
  frame: { x: number; y: number; w: number; h: number };
  photo: { x: number; y: number; w: number; h: number };
}

export const TREE_STAGE = { width: 744, height: 850 } as const;

/** Cora's double-ruled frame in the middle of the tree. */
export const TREE_CENTER = { x: 258, y: 257, w: 225, h: 288, photoW: 203, photoH: 266 } as const;

export const TREE_SLOTS: TreeSlot[] = [
  { slug: "renae", color: "rgb(255, 222, 95)", frame: { x: 88, y: 172, w: 94, h: 107 }, photo: { x: 4, y: 8, w: 86, h: 92 } },
  { slug: "marietha", color: "rgba(236, 29, 35, 0.79)", frame: { x: 53, y: 312, w: 90, h: 107 }, photo: { x: 9, y: 7, w: 73, h: 92 } },
  { slug: "joanne", color: "rgba(244, 152, 155, 0.83)", frame: { x: 120, y: 446, w: 94, h: 107 }, photo: { x: 7, y: 10, w: 78, h: 87 } },
  { slug: "derrick", color: "rgba(99, 38, 39, 0.81)", frame: { x: 247, y: 110, w: 90, h: 99 }, photo: { x: 4, y: 6, w: 80, h: 87 } },
  { slug: "anthony", color: "rgba(81, 132, 38, 0.83)", frame: { x: 416, y: 109, w: 87, h: 99 }, photo: { x: 6, y: 7, w: 74, h: 83 } },
  { slug: "tammie", color: "rgba(235, 0, 137, 0.69)", frame: { x: 565, y: 172, w: 90, h: 107 }, photo: { x: 6, y: 7, w: 78, h: 92 } },
  { slug: "tanya", color: "rgb(247, 138, 81)", frame: { x: 597, y: 311, w: 87, h: 99 }, photo: { x: 6, y: 8, w: 75, h: 83 } },
  { slug: "darwin", color: "rgb(3, 172, 239)", frame: { x: 526, y: 447, w: 99, h: 107 }, photo: { x: 5, y: 3, w: 89, h: 99 } },
];

export interface SlottedChild {
  member: TreeNode;
  slot: TreeSlot;
}

/**
 * Children whose slug matches an original slot keep that slot; everyone else fills the
 * remaining slots in CMS order. Anyone beyond the eighth is returned in `extra`
 * (rendered as a row beneath the tree, cycling through the slot colours).
 */
export function assignSlots(children: TreeNode[]): { placed: SlottedChild[]; extra: SlottedChild[] } {
  const free = new Map(TREE_SLOTS.map((s) => [s.slug, s]));
  const placed: SlottedChild[] = [];
  const waiting: TreeNode[] = [];
  for (const member of children) {
    const slot = free.get(member.slug);
    if (slot) {
      placed.push({ member, slot });
      free.delete(member.slug);
    } else waiting.push(member);
  }
  const remaining = TREE_SLOTS.filter((s) => free.has(s.slug));
  const extra: SlottedChild[] = [];
  waiting.forEach((member, i) => {
    if (i < remaining.length) placed.push({ member, slot: remaining[i] });
    else extra.push({ member, slot: TREE_SLOTS[(i - remaining.length) % TREE_SLOTS.length] });
  });
  return { placed, extra };
}
