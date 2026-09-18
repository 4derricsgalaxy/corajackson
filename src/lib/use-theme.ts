"use client";
import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}
const getSnapshot = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const getServerSnapshot = (): Theme => "light";

/** Current theme, kept in sync with the `data-theme` attribute set by the inline script and the toggle. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("cj-theme", next); } catch {}
}
