"use client";

import { useEffect } from "react";

/**
 * Ctrl+E (Cmd+E on a Mac): edit the page you are on.
 * - Snackbox editor already open on this page (its toolbar is showing): switch it from Browse to Edit.
 * - Otherwise, in a browser that has been used to edit this site before: remember this page, open
 *   Snackbox (sign in there and choose "Edit your site"), and once the editor starts, come back here.
 * Everyone else keeps the browser's own Ctrl+E.
 */

const CMS = (process.env.NEXT_PUBLIC_SNACKBOX_URL ?? "https://snackboxcms.com").replace(/\/$/, "");
const PROJECT = process.env.NEXT_PUBLIC_SNACKBOX_PROJECT ?? "corajackson";
/** set once this browser has been in edit mode; only then does Ctrl+E belong to the site */
const EDITOR_FLAG = "cj-editor";
/** the page to come back to after signing in through Snackbox */
const RETURN_KEY = "cj-edit-return";
const RETURN_TTL_MS = 20 * 60 * 1000;
/** where overlay.js keeps its 12-hour edit token */
const TOKEN_KEY = `sbx_edit_${PROJECT}`;

const read = (store: Storage, key: string) => {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
};
const write = (store: Storage, key: string, value: string | null) => {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {}
};

export function EditShortcut({ editing }: { editing: boolean }) {
  useEffect(() => {
    if (editing) write(localStorage, EDITOR_FLAG, "1");

    // the Snackbox toolbar appears a moment after load when a session is active
    const markIfBadge = () => {
      if (document.querySelector(".sbx-badge")) write(localStorage, EDITOR_FLAG, "1");
    };
    markIfBadge();
    const mo = new MutationObserver(markIfBadge);
    mo.observe(document.body, { childList: true });
    const stopWatching = window.setTimeout(() => mo.disconnect(), 15_000);

    // back from Snackbox: overlay.js swaps the ?sbxedit code for a token; then return to the remembered page
    let poll = 0;
    if (new URLSearchParams(location.search).has("sbxedit")) {
      write(localStorage, EDITOR_FLAG, "1");
      let pending: { path?: string; t?: number } | null = null;
      try {
        pending = JSON.parse(read(localStorage, RETURN_KEY) ?? "null");
      } catch {}
      const path = pending?.path;
      if (path && path.startsWith("/") && !path.startsWith("//") && Date.now() - (pending?.t ?? 0) < RETURN_TTL_MS && path !== location.pathname + location.search) {
        let tries = 0;
        poll = window.setInterval(() => {
          tries += 1;
          if (read(localStorage, TOKEN_KEY)) {
            window.clearInterval(poll);
            write(localStorage, RETURN_KEY, null);
            location.assign(path);
          } else if (tries > 60) {
            window.clearInterval(poll);
            write(localStorage, RETURN_KEY, null);
          }
        }, 250);
      } else {
        write(localStorage, RETURN_KEY, null);
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "e" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select") || t.isContentEditable)) return;

      const badge = document.querySelector(".sbx-badge");
      if (badge) {
        e.preventDefault();
        const edit = badge.querySelector<HTMLButtonElement>(".sbx-mode");
        if (edit && edit.getAttribute("aria-pressed") !== "true") edit.click();
        return;
      }
      if (read(localStorage, EDITOR_FLAG) !== "1" && !read(localStorage, TOKEN_KEY)) return;
      e.preventDefault();
      write(localStorage, RETURN_KEY, JSON.stringify({ path: location.pathname + location.search, t: Date.now() }));
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load on purpose: overlay.js starts the editor on page load
      location.assign(`${CMS}/p/${encodeURIComponent(PROJECT)}`);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      mo.disconnect();
      window.clearTimeout(stopWatching);
      window.clearInterval(poll);
    };
  }, [editing]);

  return null;
}
