"use client";

import { useSyncExternalStore } from "react";
import { emptyDesign, type Design } from "@/lib/design/model";

/**
 * The page's design on the client: what PageDesign renders and what the Design tool edits.
 * `saved` is what the CMS has; `design` is what the page shows (with unsaved changes).
 * Every recorded change keeps the previous design for Undo.
 */
export interface DesignState {
  path: string;
  /** canvas width the design's px refer to (980, the tree page 744) */
  baseW: number;
  saved: Design;
  design: Design;
  past: Design[];
  future: Design[];
}

const LIMIT = 100;
let state: DesignState = { path: "", baseW: 980, saved: emptyDesign(), design: emptyDesign(), past: [], future: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const designStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** a page mounted (or the site navigated to another page) */
  init(path: string, baseW: number, design: Design | undefined) {
    if (state.path === path && state.baseW === baseW) return;
    const d = design ?? emptyDesign();
    state = { path, baseW, saved: d, design: d, past: [], future: [] };
    emit();
  },
  /** a change that Undo can take back */
  commit(next: Design) {
    if (next === state.design) return;
    state = { ...state, design: next, past: [...state.past, state.design].slice(-LIMIT), future: [] };
    emit();
  },
  /** remember the current design as an Undo step before a drag, then `live` updates during it */
  checkpoint() {
    state = { ...state, past: [...state.past, state.design].slice(-LIMIT), future: [] };
  },
  live(next: Design) {
    state = { ...state, design: next };
    emit();
  },
  undo() {
    const prev = state.past[state.past.length - 1];
    if (!prev) return;
    state = { ...state, design: prev, past: state.past.slice(0, -1), future: [state.design, ...state.future] };
    emit();
  },
  redo() {
    const next = state.future[0];
    if (!next) return;
    state = { ...state, design: next, past: [...state.past, state.design], future: state.future.slice(1) };
    emit();
  },
  markSaved(d: Design) {
    state = { ...state, saved: d };
    emit();
  },
  discard() {
    state = { ...state, design: state.saved, past: [...state.past, state.design], future: [] };
    emit();
  },
};

export function useDesignState(): DesignState {
  return useSyncExternalStore(designStore.subscribe, designStore.get, designStore.get);
}

export const isDirty = (s: DesignState) => s.design !== s.saved && JSON.stringify(s.design) !== JSON.stringify(s.saved);
