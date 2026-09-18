"use client";
import Link from "next/link";
import { useMemo } from "react";
import type { SceneNode } from "./types";

/**
 * Accessible SVG radial tree used when WebGL is unavailable or the visitor
 * prefers reduced motion. Same data, same colors, same links.
 */
export function FamilyTree2D({ nodes, selectedId, onSelect, focusLine }: { nodes: SceneNode[]; selectedId: string | null; onSelect: (id: string | null) => void; focusLine: number | null }) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const size = 760;
  const cx = size / 2;
  const cy = size / 2;
  const scale = 26;
  const toXY = (n: SceneNode): [number, number] => {
    if (n.generation === 0) return [cx, cy];
    return [cx + n.position[0] * scale, cy + n.position[2] * scale];
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" role="img" aria-label="Family tree diagram">
      <defs>
        <radialGradient id="ground2d"><stop offset="0" stopColor="var(--paper-2)" /><stop offset="1" stopColor="transparent" /></radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={size / 2} fill="url(#ground2d)" />
      {nodes.filter((n) => n.parentId).map((n) => {
        const p = byId.get(n.parentId!);
        if (!p) return null;
        const [x1, y1] = toXY(p);
        const [x2, y2] = toXY(n);
        const dim = focusLine !== null && n.lineIndex !== focusLine;
        const mx = (x1 + x2) / 2 + (y2 - y1) * 0.15;
        const my = (y1 + y2) / 2 - (x2 - x1) * 0.15;
        return <path key={n.id} d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none" stroke={n.color} strokeOpacity={dim ? 0.1 : 0.55} strokeWidth={n.generation === 1 ? 3 : n.generation === 2 ? 1.6 : 1} />;
      })}
      {nodes.map((n) => {
        const [x, y] = toXY(n);
        const r = n.generation === 0 ? 22 : n.generation === 1 ? 14 : n.generation === 2 ? 7 : 4.5;
        const dim = focusLine !== null && n.lineIndex !== focusLine && n.generation !== 0;
        const sel = selectedId === n.id;
        return (
          <g key={n.id} opacity={dim ? 0.2 : 1} style={{ cursor: "pointer" }} onClick={() => onSelect(n.id)}>
            <circle cx={x} cy={y} r={r + (sel ? 4 : 0)} fill={n.color} stroke={sel ? "var(--gold-2)" : "var(--paper)"} strokeWidth={sel ? 3 : 1.5} />
            {n.generation <= 1 && (
              <text x={x} y={y + r + 14} textAnchor="middle" fontSize={n.generation === 0 ? 15 : 12} fill="var(--ink)" fontFamily="var(--font-display)">
                {n.generation === 1 ? n.nickname ?? n.title.split(" ")[0] : n.title}
              </text>
            )}
            <title>{n.title}</title>
          </g>
        );
      })}
      <foreignObject x={0} y={size - 30} width={size} height={30}>
        <p className="text-center text-xs text-ink-3">Click a circle to learn about that person. <Link className="underline" href="/family">Or browse the lines as a list.</Link></p>
      </foreignObject>
    </svg>
  );
}
