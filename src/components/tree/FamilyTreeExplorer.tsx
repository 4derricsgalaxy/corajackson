"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useTheme } from "@/lib/use-theme";
import { clsx } from "clsx";
import type { SceneLine, SceneNode } from "./types";
import { CmsImage } from "../ui/CmsImage";
import { FamilyTree2D } from "./FamilyTree2D";

const FamilyTreeScene = dynamic(() => import("./FamilyTreeScene").then((m) => m.FamilyTreeScene), {
  ssr: false,
  loading: () => <TreeLoading />,
});

const GEN_LABEL = ["Matriarch", "Daughter or son of Cora", "Grandchild", "Great-grandchild", "Great-great-grandchild"];

export function FamilyTreeExplorer({ nodes, lines, initialSelected }: { nodes: SceneNode[]; lines: SceneLine[]; initialSelected?: string | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected ?? null);
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const detected = useSyncExternalStore(noopSubscribe, detectMode, () => "pending" as const);
  const [override, setOverride] = useState<"3d" | "2d" | null>(null);
  const mode: "3d" | "2d" | "pending" = override ?? detected;
  const dark = useTheme() === "dark";

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const children = useMemo(() => nodes.filter((n) => n.parentId === selectedId), [nodes, selectedId]);
  const ancestors = useMemo(() => {
    const out: SceneNode[] = [];
    let cur = selected?.parentId ? byId.get(selected.parentId) : undefined;
    while (cur) { out.unshift(cur); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
    return out;
  }, [selected, byId]);

  const switchMode = (m: "3d" | "2d") => { setOverride(m); try { localStorage.setItem("cj-tree-mode", m); } catch {} };

  return (
    <div className="relative grid min-h-[78vh] grid-rows-[auto_1fr] gap-0 lg:grid-cols-[1fr_360px] lg:grid-rows-1">
      {/* canvas */}
      <div className="relative min-h-[60vh] overflow-hidden rounded-lg border border-line bg-gradient-to-b from-paper-2/60 to-paper">
        {mode === "3d" && <FamilyTreeScene nodes={nodes} selectedId={selectedId} focusLine={focusLine} onSelect={setSelectedId} dark={dark} />}
        {mode === "2d" && <div className="absolute inset-0 p-4"><FamilyTree2D nodes={nodes} selectedId={selectedId} onSelect={setSelectedId} focusLine={focusLine} /></div>}
        {mode === "pending" && <TreeLoading />}

        {/* line filter chips */}
        <div className="scrollbar-none absolute left-3 right-3 top-3 flex gap-1.5 overflow-x-auto">
          <button type="button" onClick={() => setFocusLine(null)} className={chip(focusLine === null)}>All lines</button>
          {lines.map((l) => (
            <button key={l.slug} type="button" onClick={() => setFocusLine(focusLine === l.index ? null : l.index)} className={chip(focusLine === l.index)}>
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />{l.title}
            </button>
          ))}
        </div>

        <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs text-ink-3">
          <span className="hidden sm:inline">{mode === "3d" ? "Drag to orbit · scroll to zoom · click a person" : "Click a person"}</span>
        </div>
        <div className="absolute bottom-3 right-3 flex overflow-hidden rounded-full border border-line bg-paper/80 text-xs backdrop-blur">
          <button type="button" onClick={() => switchMode("3d")} className={clsx("px-3 py-1.5", mode === "3d" && "bg-ink text-paper")}>3D</button>
          <button type="button" onClick={() => switchMode("2d")} className={clsx("px-3 py-1.5", mode === "2d" && "bg-ink text-paper")}>Diagram</button>
        </div>
      </div>

      {/* side panel */}
      <aside className="flex flex-col gap-5 p-5 lg:pl-8" aria-live="polite">
        {!selected ? (
          <div className="rise">
            <p className="eyebrow mb-3">How to explore</p>
            <h2 className="font-display text-3xl leading-tight">Every leaf is a person.</h2>
            <p className="mt-3 text-ink-2">Ms. Cora is the trunk. Her eight children are the great branches, each in its own color. Grandchildren and great-grandchildren grow outward from there.</p>
            <ul className="mt-5 space-y-2 text-sm text-ink-3">
              <li>· Click any portrait or leaf to read about that person.</li>
              <li>· Use the colored chips to follow one family line at a time.</li>
              <li>· Open a person&apos;s page for photos, stories, and their own children.</li>
            </ul>
            <div className="mt-8 grid grid-cols-2 gap-2">
              {lines.map((l) => (
                <button key={l.slug} type="button" onClick={() => { setFocusLine(l.index); const n = nodes.find((x) => x.slug === l.slug); if (n) setSelectedId(n.id); }} className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-sm transition hover:border-gold">
                  <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />{l.title}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div key={selected.id} className="rise">
            <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-ink-3" aria-label="Lineage">
              {ancestors.map((a) => (
                <span key={a.id} className="flex items-center gap-1">
                  <button type="button" onClick={() => setSelectedId(a.id)} className="link-underline">{a.generation === 0 ? a.title.split(" ")[0] : a.nickname ?? a.title.split(" ")[0]}</button>
                  <span>›</span>
                </span>
              ))}
              <span className="text-ink">{selected.nickname ?? selected.title.split(" ")[0]}</span>
            </nav>
            <div className="flex items-start gap-4">
              <div className="frame w-28 shrink-0">
                <CmsImage src={selected.portrait} alt={selected.title} width={112} height={140} className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="eyebrow" style={{ color: selected.color }}>{GEN_LABEL[selected.generation] ?? "Family"}</p>
                <h2 className="mt-1 font-display text-2xl leading-tight">{selected.title}</h2>
                {selected.nickname && selected.nickname !== selected.title && <p className="text-sm italic text-ink-3">“{selected.nickname}”</p>}
                {(selected.birthDate || selected.deathDate) && (
                  <p className="mt-1 font-mono text-xs text-ink-3">{selected.birthDate?.slice(0, 4)}{selected.deathDate ? ` – ${selected.deathDate.slice(0, 4)}` : ""}</p>
                )}
              </div>
            </div>
            {selected.shortBio && <p className="mt-4 text-ink-2">{selected.shortBio}</p>}
            <Link href={`/family/${selected.slug}`} className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm text-paper transition hover:bg-oak">
              Open {selected.nickname ?? selected.title.split(" ")[0]}&apos;s page <span aria-hidden>→</span>
            </Link>
            {children.length > 0 && (
              <div className="mt-7">
                <p className="eyebrow mb-2">{children.length === 1 ? "Child" : `${children.length} children`}</p>
                <ul className="divide-y divide-line border-y border-line">
                  {children.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setSelectedId(c.id)} className="flex w-full items-center gap-3 py-2 text-left text-sm transition hover:text-gold">
                        <span className="h-9 w-7 overflow-hidden rounded-sm bg-paper-3"><CmsImage src={c.portrait} alt="" width={56} height={72} className="h-full w-full object-cover" /></span>
                        <span className="flex-1">{c.title}</span>
                        {c.childCount > 0 && <span className="font-mono text-[0.6rem] text-ink-3">+{c.childCount}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button type="button" onClick={() => setSelectedId(selected.parentId)} className="mt-6 text-xs text-ink-3 link-underline">
              {selected.parentId ? "↑ Back up to " + ((byId.get(selected.parentId)?.generation === 0 ? undefined : byId.get(selected.parentId)?.nickname) ?? byId.get(selected.parentId)?.title.split(" ")[0]) : "↑ Back to overview"}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

const noopSubscribe = () => () => {};
let detectedMode: "3d" | "2d" | null = null;
/** Runs once on the client: WebGL available, no reduced-motion preference, and no saved "2d" choice → 3D. */
function detectMode(): "3d" | "2d" {
  if (detectedMode) return detectedMode;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  let saved: string | null = null;
  try { saved = localStorage.getItem("cj-tree-mode"); } catch {}
  detectedMode = saved === "2d" || reduce || !gl ? "2d" : "3d";
  return detectedMode;
}

function chip(active: boolean) {
  return clsx(
    "shrink-0 rounded-full border px-3 py-1 text-xs backdrop-blur transition",
    active ? "border-ink bg-ink text-paper" : "border-line bg-paper/70 text-ink-2 hover:border-gold",
  );
}

function TreeLoading() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="text-center">
        <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border border-line border-t-gold" />
        <p className="eyebrow">Growing the tree…</p>
      </div>
    </div>
  );
}
