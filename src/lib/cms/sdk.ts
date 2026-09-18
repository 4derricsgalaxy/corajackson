// ---------------------------------------------------------------------------
// @snackbox/sdk — the fluent client used by every site frontend.
// Wix-Data-simple to write, GraphQL-class in what one round trip returns.
//
//   const albums = await cms("stephanie")
//     .query("album")
//     .eq("albumType", "LP")
//     .order("releaseYear", "desc")
//     .include("cover")
//     .find();
//
// Zero dependencies; works in RSC, route handlers, and the browser.
// ---------------------------------------------------------------------------

/**
 * Default read cache TTL, in seconds. Deliberately short: this bounds how long
 * a published change stays invisible, which is the thing clients notice and
 * report as "the CMS isn't working".
 */
const DEFAULT_REVALIDATE = 15;

/**
 * Cache tags, mirroring src/lib/revalidate.ts on the CMS side. Every cached
 * read carries the project tag plus the narrowest tag that describes it; the
 * CMS expires the narrow ones on write and the project one on schema changes
 * and bulk imports. Keep both sides in step — a tag the CMS never sends is a
 * page that never updates, and nothing warns you.
 */
export const cacheTags = {
  project: (project: string) => `sbx:${project}`,
  type: (project: string, type: string) => `sbx:${project}:type:${type}`,
  doc: (project: string, id: string) => `sbx:${project}:doc:${id}`,
};

export interface CmsOptions {
  /** CMS base URL; defaults to NEXT_PUBLIC_SNACKBOX_URL or SNACKBOX_URL */
  baseUrl?: string;
  /** write/admin token — only needed for mutate() */
  token?: string;
  /**
   * Seconds to cache reads for. Defaults to 15.
   *
   * This is the number that decides how long after publishing a client sees
   * their change, and it is easy to misread: revalidatePath() purges Next's
   * route cache, but a re-render can still reuse a fresh entry from the
   * separate Data Cache, so a long TTL here keeps serving old content even
   * though the revalidation webhook returned success. A site running 300 had
   * editors watching a correct publish sit invisible for five minutes.
   *
   * Push revalidation is the freshness mechanism; this is the backstop. Raise
   * it only if CMS read volume becomes a problem. Pass 0 to disable caching.
   */
  revalidate?: number;
  /**
   * Edit-session hook. Return false/null when the request is public (the
   * usual case), true when it's an edit session (e.g. Next draft mode) —
   * reads then fetch uncached with stega=1 so the overlay can map rendered
   * values back to fields — or the overlay edit token (a string) to also
   * read the draft perspective: the editor sees unpublished changes in
   * place, authorized by that token. Never affects public rendering.
   */
  editMode?: () => boolean | string | null | Promise<boolean | string | null>;
}

type FilterOp = "eq" | "neq" | "in" | "gt" | "gte" | "lt" | "lte" | "defined" | "match";

interface Filter {
  op: FilterOp;
  path: string;
  value?: unknown;
}

export class QueryBuilder<T = Record<string, unknown>> {
  private filters: Filter[] = [];
  private orders: { path: string; dir: "asc" | "desc" }[] = [];
  private _limit?: number;
  private _offset?: number;
  private includes: string[] = [];
  private _locale?: string;
  private _perspective?: "published" | "draft";

  constructor(
    private client: CmsClient,
    private type: string
  ) {}

  eq(path: string, value: unknown) { this.filters.push({ op: "eq", path, value }); return this; }
  neq(path: string, value: unknown) { this.filters.push({ op: "neq", path, value }); return this; }
  in(path: string, value: unknown[]) { this.filters.push({ op: "in", path, value }); return this; }
  gt(path: string, value: unknown) { this.filters.push({ op: "gt", path, value }); return this; }
  gte(path: string, value: unknown) { this.filters.push({ op: "gte", path, value }); return this; }
  lt(path: string, value: unknown) { this.filters.push({ op: "lt", path, value }); return this; }
  lte(path: string, value: unknown) { this.filters.push({ op: "lte", path, value }); return this; }
  defined(path: string) { this.filters.push({ op: "defined", path }); return this; }
  match(path: string, value: string) { this.filters.push({ op: "match", path, value }); return this; }
  order(path: string, dir: "asc" | "desc" = "asc") { this.orders.push({ path, dir }); return this; }
  limit(n: number) { this._limit = n; return this; }
  offset(n: number) { this._offset = n; return this; }
  /** replace {_ref} values at these paths with the referenced document/asset */
  include(...paths: string[]) { this.includes.push(...paths); return this; }
  locale(l: string) { this._locale = l; return this; }
  drafts() { this._perspective = "draft"; return this; }

  async find(): Promise<T[]> {
    const q = {
      type: this.type,
      filters: this.filters.length ? this.filters : undefined,
      order: this.orders.length ? this.orders : undefined,
      limit: this._limit,
      offset: this._offset,
      include: this.includes.length ? this.includes : undefined,
      locale: this._locale,
      perspective: this._perspective,
    };
    const { result } = await this.client.request<{ result: T[] }>(
      `query?q=${encodeURIComponent(JSON.stringify(q))}`,
      {},
      { type: this.type }
    );
    return result;
  }

  async first(): Promise<T | null> {
    this._limit = 1;
    const results = await this.find();
    return results[0] ?? null;
  }
}

/**
 * A non-2xx answer from the CMS. `message` keeps the historical
 * "SnackBox <status>: <detail>" text (callers match on it), while `status` and
 * `detail` let a site show the visitor something usable — an intake form's 422
 * (rejected as spam) and 429 (the form's hourly ceiling) both carry a
 * plain-language `detail` written to be displayed as-is.
 */
export class SnackboxError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
    readonly context: { code?: string; currentRevision?: string; traceId?: string } = {}
  ) {
    super(`SnackBox ${status}: ${detail}`);
    this.name = "SnackboxError";
  }
}

export interface Mutation {
  create?: { type: string; data: Record<string, unknown>; id?: string; locale?: string; expectedRevision?: string };
  patch?: { id: string; set?: Record<string, unknown>; unset?: string[]; expectedRevision?: string };
  delete?: { id: string; expectedRevision?: string };
  publish?: { id: string; expectedRevision?: string };
  discardDraft?: { id: string; expectedRevision?: string };
}

export class CmsClient {
  constructor(
    private project: string,
    private opts: CmsOptions = {}
  ) {}

  private get baseUrl(): string {
    const base =
      this.opts.baseUrl ??
      (typeof process !== "undefined"
        ? process.env.NEXT_PUBLIC_SNACKBOX_URL ?? process.env.SNACKBOX_URL
        : undefined);
    if (!base) throw new Error("SnackBox SDK: set NEXT_PUBLIC_SNACKBOX_URL or pass baseUrl");
    return base.replace(/\/$/, "");
  }

  async request<R>(
    path: string,
    init: RequestInit = {},
    tagsFor: { type?: string; doc?: string } = {}
  ): Promise<R> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (this.opts.token) headers.Authorization = `Bearer ${this.opts.token}`;
    const fetchInit = { ...init, headers } as RequestInit & {
      next?: { revalidate: number; tags: string[] };
    };
    // `?? 60` and not `|| 60`, so an explicit 0 still means "never cache".
    if (!init.method) {
      const tags = [cacheTags.project(this.project)];
      if (tagsFor.type) tags.push(cacheTags.type(this.project, tagsFor.type));
      if (tagsFor.doc) tags.push(cacheTags.doc(this.project, tagsFor.doc));
      fetchInit.next = { revalidate: this.opts.revalidate ?? DEFAULT_REVALIDATE, tags };
    }
    let edit: boolean | string | null = false;
    if (this.opts.editMode && !init.method) {
      try { edit = await this.opts.editMode(); } catch { /* outside a request scope */ }
    }
    if (edit) {
      if (typeof edit === "string") {
        // Token-backed edit session: read drafts in place. The perspective
        // rides inside the fluent q payload (the API gates on it there);
        // doc reads take it as a query param. Explicit .drafts() etc. win.
        headers.Authorization = `Bearer ${edit}`;
        const m = path.match(/^query\?q=(.+)$/);
        if (m) {
          const q = JSON.parse(decodeURIComponent(m[1])) as { perspective?: string };
          q.perspective ??= "draft";
          path = `query?q=${encodeURIComponent(JSON.stringify(q))}`;
        } else {
          path += (path.includes("?") ? "&" : "?") + "perspective=draft";
        }
      }
      path += (path.includes("?") ? "&" : "?") + "stega=1";
      fetchInit.cache = "no-store";
      delete fetchInit.next;
    }
    const res = await fetch(`${this.baseUrl}/api/v1/${this.project}/${path}`, fetchInit);
    const text = await res.text();
    let parsed: (R & { error?: string }) | undefined;
    try {
      parsed = text ? (JSON.parse(text) as R & { error?: string }) : undefined;
    } catch {
      parsed = undefined;
    }
    if (!res.ok) {
      const detail =
        (parsed && typeof parsed.error === "string" && parsed.error) ||
        (text && !text.startsWith("<") ? text.slice(0, 200) : "") ||
        `CMS returned a non-JSON ${res.status} response`;
      throw new SnackboxError(res.status, detail, (parsed ?? {}) as { code?: string; currentRevision?: string; traceId?: string });
    }
    if (parsed === undefined) {
      throw new SnackboxError(res.status, "CMS returned a non-JSON response");
    }
    return parsed as R;
  }

  query<T = Record<string, unknown>>(type: string): QueryBuilder<T> {
    return new QueryBuilder<T>(this, type);
  }

  async doc<T = Record<string, unknown>>(id: string, opts: { locale?: string } = {}): Promise<T | null> {
    try {
      const { result } = await this.request<{ result: T }>(`doc/${encodeURIComponent(id)}${opts.locale ? `?locale=${encodeURIComponent(opts.locale)}` : ""}`, {}, { doc: id });
      return result;
    } catch (e) {
      if (e instanceof Error && e.message.includes("404")) return null;
      throw e;
    }
  }

  /** escape hatch: full GROQ */
  async groq<T = unknown>(query: string, params?: Record<string, unknown>): Promise<T> {
    const p = params ? `&params=${encodeURIComponent(JSON.stringify(params))}` : "";
    const { result } = await this.request<{ result: T }>(`query?groq=${encodeURIComponent(query)}${p}`);
    return result;
  }

  /** write path — requires a write/admin token */
  async mutate(mutations: Mutation[], opts: { locale?: string; actor?: string; operationId?: string; perspective?: "draft" | "published" } = {}) {
    return this.request<{ results: unknown[] }>("mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutations, ...opts }),
    });
  }

  /**
   * Public form submission (RSVPs, contact forms).
   *
   * Include formGuardFields() in `data` — see below. Without them the CMS still
   * accepts the submission (forms written before the guard existed keep
   * working), but the form has no spam protection beyond the global per-form
   * hourly ceiling, and a rejected submission answers 422 with a message worth
   * showing the visitor.
   */
  async intake(form: string, data: Record<string, unknown>) {
    return this.request<{ ok: boolean; id: string }>(`intake/${form}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  /**
   * Every event in a collection, split into upcoming and past AT RENDER TIME.
   * Past-ness is a query concern, never a stored flag — no archive cron, no
   * `archived` column to drift out of step with the calendar.
   */
  async events<T extends EventTimes = Record<string, unknown> & EventTimes>(
    type: string,
    opts: { include?: string[]; limit?: number; now?: Date } = {}
  ): Promise<{ upcoming: T[]; past: T[] }> {
    const q = this.query<T>(type).order("start", "asc").limit(opts.limit ?? 500);
    q.include(...(opts.include ?? ["venue", "image"]));
    return splitEvents(await q.find(), opts.now);
  }

  /** Public RSVP. No token: the endpoint is rate-limited and schema-validated. */
  async registerForEvent(
    collection: string,
    docId: string,
    guest: { name: string; email: string; answers?: Record<string, unknown> }
  ) {
    return this.request<{ ok: boolean; status: string }>(
      `events/${collection}/${docId}/register`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(guest),
      }
    );
  }

  /** Add-to-calendar download for one event. */
  icsEventUrl(collection: string, docId: string): string {
    return `${this.baseUrl}/api/v1/${this.project}/events/${stegaClean(collection)}/${stegaClean(docId)}/event.ics`;
  }

  /**
   * The subscribe feed. `webcal: true` swaps the scheme so a click hands the
   * URL to the OS calendar app instead of downloading a file — same endpoint.
   */
  icsFeedUrl(collection: string, opts: { webcal?: boolean } = {}): string {
    const url = `${this.baseUrl}/api/v1/${this.project}/events/${stegaClean(collection)}/feed.ics`;
    return opts.webcal ? url.replace(/^https?:/, "webcal:") : url;
  }
}

export function cms(project: string, opts?: CmsOptions): CmsClient {
  return new CmsClient(project, opts);
}

// ---------------------------------------------------------------------------
// Form spam guard. Two hidden fields, no configuration, no third party, no
// captcha: a honeypot input a person never fills, and the time the form was
// RENDERED so the CMS can refuse anything submitted faster than a human can
// type. Both are stripped server-side — they never reach the stored document,
// the notify webhook, or the notification email.
//
//   const guard = useState(formGuardFields)[0];   // render time, not submit time
//   ...
//   <input {...honeypotInputProps} defaultValue="" />
//   <input type="hidden" name="_renderedAt" value={guard._renderedAt} />
//   await site.intake("contactMessage", { ...guard, ...values });
//
// Capture the fields ONCE at render (useState initializer, or a server-rendered
// hidden input) — calling formGuardFields() at submit time stamps "now" and the
// submission is refused as too fast.
//
// SPREAD ORDER MATTERS: `...values` LAST. The honeypot's value must travel
// with the form's own values — a bot that fills the off-screen input puts its
// payload in `values._hp`, and if the guard were spread last its `_hp` would
// overwrite the bot's fill and the trap could never trip. The guard therefore
// carries ONLY `_renderedAt`; `_hp` reaches the CMS from the form itself
// ("" for a person, the bot's fill otherwise).
// ---------------------------------------------------------------------------

/** name of the honeypot field the CMS checks */
export const HONEYPOT_FIELD = "_hp";
/** name of the render-time field the CMS checks */
export const RENDERED_AT_FIELD = "_renderedAt";

export interface FormGuardFields {
  _renderedAt: number;
}

/**
 * The hidden value every SnackBox form should carry. Call at RENDER time.
 * Deliberately does NOT include the honeypot — see the spread-order note above.
 */
export function formGuardFields(): FormGuardFields {
  return { [RENDERED_AT_FIELD]: Date.now() } as FormGuardFields;
}

/**
 * Props for the honeypot input. Off-screen rather than `type="hidden"` (bots
 * skip hidden inputs more often than they skip invisible text ones) and hidden
 * from assistive tech and the tab order, so no real visitor can reach it.
 */
export const honeypotInputProps = {
  name: HONEYPOT_FIELD,
  type: "text",
  tabIndex: -1,
  autoComplete: "off",
  "aria-hidden": true,
  style: { position: "absolute", left: "-9999px", width: "1px", height: "1px", opacity: 0 },
} as const;

// ---------------------------------------------------------------------------
// Image art direction (crop / hotspot), set in the CMS's image editor and
// stored on the field value as fractions. Until a transforming media CDN is
// wired (R2 + Cloudflare, spec §11), sites honor it with CSS: object-fit:
// cover plus the object-position below keeps the chosen focal point visible
// at any output size. Plain {_ref} values (no art direction) work unchanged.
// ---------------------------------------------------------------------------

export interface ImageValue {
  /** Placement accessibility metadata; decorative images resolve to empty alt. */
  decorative?: boolean;
  _ref?: string;
  url?: string;
  alt?: string;
  crop?: { left: number; top: number; width: number; height: number };
  hotspot?: { x: number; y: number };
}

const pct = (n: number) => `${Math.round(n * 10000) / 100}%`;

const STEGA_BLOCK = /\u200D[\u200B\u200C]*\u2060/g;

/** Strip stega payloads from a string (or pass non-strings through). */
export function stegaClean<T>(value: T): T {
  if (typeof value === "string") return value.replace(STEGA_BLOCK, "") as T;
  return value;
}

/** resolved URL of an .include()d image field — null when empty/unresolved */
export function imageUrl(img: ImageValue | null | undefined): string | null {
  const url = img?.url ?? null;
  return url === null ? null : stegaClean(url);
}

/** CSS object-position honoring the hotspot (or the crop's center) */
export function imagePosition(img: ImageValue | null | undefined): string | undefined {
  if (img?.hotspot) return stegaClean(`${pct(img.hotspot.x)} ${pct(img.hotspot.y)}`);
  if (img?.crop) return stegaClean(`${pct(img.crop.left + img.crop.width / 2)} ${pct(img.crop.top + img.crop.height / 2)}`);
  return undefined;
}

/** drop-in for <img style> or next/image (use fill + a sized wrapper) */
export function imageProps(img: ImageValue | null | undefined): {
  src: string | null;
  style: { objectFit: "cover"; objectPosition?: string };
} {
  return { src: imageUrl(img), style: { objectFit: "cover", objectPosition: imagePosition(img) } };
}

// ---------------------------------------------------------------------------
// Event times. Event documents store WALL time (`2026-08-14T19:00`) plus a
// separate IANA `timezone`, so 7pm stays 7pm when DST moves underneath it.
// Converting to an instant therefore has to ask the zone, twice: the first
// pass guesses with the offset at the naive instant, the second corrects it
// when that guess landed on the other side of a transition.
//
// Ambiguous wall times (the repeated hour when clocks fall back) resolve to
// the FIRST occurrence; nonexistent ones (the skipped hour in spring) shift
// forward. Both are the conventional choices and neither throws.
// ---------------------------------------------------------------------------

export interface EventTimes {
  start?: string | null;
  end?: string | null;
  timezone?: string | null;
}

/** True when `tz` is a zone this runtime's ICU knows. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Offset of `timeZone` from UTC at a given instant, in minutes (east positive). */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const { type, value } of dtf.formatToParts(instant)) {
    if (type !== "literal") p[type] = Number(value);
  }
  // `hour % 24` because en-US formats midnight as hour 24 in some ICU builds.
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return (asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000;
}

/** `2026-08-14T19:00` in `America/New_York` → the matching UTC instant. */
export function wallTimeToUtc(wall: string, timeZone: string): Date {
  const naive = Date.parse(wall.length === 16 ? `${wall}:00Z` : `${wall}Z`);
  if (Number.isNaN(naive)) return new Date(NaN);
  let ms = naive - zoneOffsetMinutes(new Date(naive), timeZone) * 60000;
  ms = naive - zoneOffsetMinutes(new Date(ms), timeZone) * 60000;
  return new Date(ms);
}

/** The offset in force for that wall time, as `+HH:MM` / `-HH:MM`. */
export function zoneOffsetLabel(wall: string, timeZone: string): string {
  const minutes = zoneOffsetMinutes(wallTimeToUtc(wall, timeZone), timeZone);
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

/** ISO 8601 with the explicit offset Google requires on Event startDate/endDate. */
export function isoWithOffset(wall: string, timeZone: string): string {
  return `${wall}:00${zoneOffsetLabel(wall, timeZone)}`;
}

function instant(wall: string | null | undefined, tz: string | null | undefined): Date | null {
  if (!wall || !tz || !isValidTimeZone(tz)) return null;
  const d = wallTimeToUtc(wall, tz);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function eventStartUtc(ev: EventTimes): Date | null {
  return instant(ev.start, ev.timezone);
}

export function eventEndUtc(ev: EventTimes): Date | null {
  return instant(ev.end, ev.timezone);
}

/**
 * Past-ness is a query concern computed at render time, never a stored flag —
 * no archive cron, no `archived` column to drift. An event with no usable end
 * is never past.
 */
export function isPastEvent(ev: EventTimes, now: Date = new Date()): boolean {
  const end = eventEndUtc(ev) ?? eventStartUtc(ev);
  return end !== null && end.getTime() < now.getTime();
}

// ---------------------------------------------------------------------------
// Site-side event helpers (spec §5): the upcoming/past split and the
// schema.org markup. Emitting the FULL recommended property set is
// deliberate — partial Event markup is what earns Search Console warnings,
// and the required ones (startDate with offset, endDate, location,
// eventStatus, previousStartDate on a move) are exactly the ones a
// hand-rolled implementation leaves out.
//
// `onlineUrl` is never emitted here. Spec §1 gates it to confirmed guests and
// JSON-LD is the most public thing on the page; an online event's
// VirtualLocation carries the event page URL instead.
//
// v1.5 adds `offers` (one per ticket type) — nothing else in this function
// changes when money arrives.
// ---------------------------------------------------------------------------

export interface EventVenue {
  name?: string;
  address?: { street?: string; city?: string; region?: string; postalCode?: string; country?: string };
  geo?: { lat?: number; lng?: number };
}

export interface EventDoc extends EventTimes {
  title?: string;
  excerpt?: string;
  image?: ImageValue | null;
  attendanceMode?: string;
  status?: string;
  previousStart?: string | null;
  venue?: EventVenue | null;
  /** present on the document, never emitted in markup — spec §1 gates it to confirmed guests */
  onlineUrl?: string | null;
  registrationMode?: string;
  ticketsUrl?: string | null;
  capacity?: number | null;
}

/** Upcoming ascending (next first), past descending (most recent first). */
export function splitEvents<T extends EventTimes>(
  events: T[],
  now: Date = new Date()
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const e of events) (isPastEvent(e, now) ? past : upcoming).push(e);
  const key = (e: T) => eventStartUtc(e)?.getTime() ?? 0;
  upcoming.sort((a, b) => key(a) - key(b));
  past.sort((a, b) => key(b) - key(a));
  return { upcoming, past };
}

const ATTENDANCE_MODE: Record<string, string> = {
  in_person: "https://schema.org/OfflineEventAttendanceMode",
  online: "https://schema.org/OnlineEventAttendanceMode",
  hybrid: "https://schema.org/MixedEventAttendanceMode",
};

const EVENT_STATUS: Record<string, string> = {
  scheduled: "https://schema.org/EventScheduled",
  sold_out: "https://schema.org/EventScheduled",
  cancelled: "https://schema.org/EventCancelled",
  postponed: "https://schema.org/EventPostponed",
  rescheduled: "https://schema.org/EventRescheduled",
};

function placeFor(venue: EventVenue): Record<string, unknown> {
  const a = venue.address ?? {};
  const address: Record<string, unknown> = { "@type": "PostalAddress" };
  if (a.street) address.streetAddress = stegaClean(a.street);
  if (a.city) address.addressLocality = stegaClean(a.city);
  if (a.region) address.addressRegion = stegaClean(a.region);
  if (a.postalCode) address.postalCode = stegaClean(a.postalCode);
  if (a.country) address.addressCountry = stegaClean(a.country);

  const place: Record<string, unknown> = { "@type": "Place" };
  if (venue.name) place.name = stegaClean(venue.name);
  if (Object.keys(address).length > 1) place.address = address;
  if (typeof venue.geo?.lat === "number" && typeof venue.geo?.lng === "number") {
    place.geo = { "@type": "GeoCoordinates", latitude: venue.geo.lat, longitude: venue.geo.lng };
  }
  return place;
}

export function eventJsonLd(
  event: EventDoc,
  opts: { url?: string | null; organizerName?: string | null; organizerUrl?: string | null } = {}
): Record<string, unknown> {
  const tz = event.timezone && isValidTimeZone(stegaClean(event.timezone)) ? stegaClean(event.timezone) : null;
  const ld: Record<string, unknown> = { "@context": "https://schema.org", "@type": "Event" };
  if (event.title) ld.name = stegaClean(event.title);
  if (event.excerpt) ld.description = stegaClean(event.excerpt);
  if (event.start && tz) ld.startDate = isoWithOffset(stegaClean(event.start), tz);
  if (event.end && tz) ld.endDate = isoWithOffset(stegaClean(event.end), tz);
  if (event.previousStart && tz) ld.previousStartDate = isoWithOffset(stegaClean(event.previousStart), tz);

  const mode = stegaClean(event.attendanceMode) ?? "in_person";
  ld.eventAttendanceMode = ATTENDANCE_MODE[mode] ?? ATTENDANCE_MODE.in_person;
  ld.eventStatus = EVENT_STATUS[stegaClean(event.status) ?? "scheduled"] ?? EVENT_STATUS.scheduled;

  const place = event.venue ? placeFor(event.venue) : null;
  // VirtualLocation points at the public event page: the real join link is
  // gated to confirmed guests (spec §1) and must never be published here.
  const pageUrl = opts.url ? stegaClean(opts.url) : null;
  const virtual = pageUrl ? { "@type": "VirtualLocation", url: pageUrl } : null;
  if (mode === "hybrid" && place && virtual) ld.location = [place, virtual];
  else if (mode === "online" && virtual) ld.location = virtual;
  else if (place) ld.location = place;

  const img = imageUrl(event.image);
  if (img) ld.image = img;
  if (pageUrl) ld.url = pageUrl;
  if (opts.organizerName) {
    ld.organizer = {
      "@type": "Organization",
      name: stegaClean(opts.organizerName),
      ...(opts.organizerUrl ? { url: stegaClean(opts.organizerUrl) } : {}),
    };
  }
  return ld;
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** "Add to Google Calendar" — the other half of add-to-calendar, next to the .ics. */
export function googleCalendarUrl(
  event: EventDoc,
  opts: { url?: string | null; location?: string | null } = {}
): string | null {
  const start = eventStartUtc(event);
  if (!start) return null;
  const end = eventEndUtc(event) ?? new Date(start.getTime() + 2 * 3600_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: stegaClean(event.title) ?? "Event",
    dates: `${stamp(start)}/${stamp(end)}`,
  });
  const details = [stegaClean(event.excerpt), stegaClean(opts.url)].filter(Boolean).join("\n\n");
  if (details) params.set("details", details);
  if (opts.location) params.set("location", stegaClean(opts.location));
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}


/** Exact editable source binding, including blank/image-only fields. */
export function editableField(docId: string, fieldPath: string, locale?: string) {
  return { "data-sbx-doc": docId, "data-sbx-field": fieldPath,
    ...(locale ? { "data-sbx-locale": locale } : {}) };
}

export interface PageDocument { docId: string; title: string; locale?: string }
/** Attach to the overlay script so the page picker includes unrendered fields. */
export function editablePage(documents: PageDocument[], locale?: string) {
  return { "data-documents": JSON.stringify(documents), ...(locale ? { "data-locale": locale } : {}) };
}
