import { cms } from "./sdk";

export const PROJECT = process.env.NEXT_PUBLIC_SNACKBOX_PROJECT ?? "corajackson";

/**
 * Read client for Snackbox. Pages are static and revalidated hourly (or
 * instantly via /api/revalidate when the CMS publishes), so a 1h data-cache
 * TTL is safe here: the revalidation webhook expires the tags on publish.
 */
export const site = cms(PROJECT, { revalidate: 3600 });

const TRIES = 5;

/**
 * One list read from Snackbox, asked again when it stumbles. Under load (a build renders ~140 pages at once) Snackbox
 * sometimes fails a request (HTTP 500) or answers OK with an EMPTY list. Believing either baked "not found" person
 * pages, the old local seed, or pages without their saved Design into a build. Every list this site reads has entries,
 * so an empty answer is asked again too, and only the last try's answer is believed. Each retry is a new URL
 * (`&try=N`), so the data cache can't hand back the bad answer. Still failing after the last try: the error goes to
 * the caller, which falls back exactly as before.
 */
export async function findSteady<T>(q: { find(attempt?: number): Promise<T[]> }, { emptyOk = false } = {}): Promise<T[]> {
  let failure: unknown;
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, 400 * (attempt - 1)));
    try {
      const rows = await q.find(attempt);
      // (a later page of a paged read may really be empty: the list ended exactly on a page boundary)
      if (rows.length > 0 || emptyOk || attempt === TRIES) return rows;
    } catch (err) {
      failure = err;
      if (attempt === TRIES) break;
    }
  }
  throw failure;
}
