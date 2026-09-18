import { cms } from "./sdk";

export const PROJECT = process.env.NEXT_PUBLIC_SNACKBOX_PROJECT ?? "corajackson";

/**
 * Read client for Snackbox. Pages are static and revalidated hourly (or
 * instantly via /api/revalidate when the CMS publishes), so a 1h data-cache
 * TTL is safe here: the revalidation webhook expires the tags on publish.
 */
export const site = cms(PROJECT, { revalidate: 3600 });
