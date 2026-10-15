/**
 * Requests from the on-page editing tools (Design, Crop, Add photos), with a time limit and messages a
 * family member can act on — never "Failed to fetch" or a bare status number.
 */

/** the server functions allow 60 s; give the answer a little longer to arrive */
const LIMIT_MS = 75_000;

export function sendJson(url: string, body: unknown, timeoutMs = LIMIT_MS): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export function sendForm(url: string, form: FormData, timeoutMs = LIMIT_MS): Promise<Response> {
  return fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(timeoutMs) });
}

/** what to say when the server answered with an error but no message of its own */
export function failText(status: number, verb: string): string {
  if (status === 401) return `Could not ${verb}: you are signed out. Sign in again, then try once more.`;
  if (status === 403) return `Could not ${verb}: this page is not one you can change.`;
  if (status === 413) return `Could not ${verb}: it is too big. Use a smaller picture (or fewer at once) and try again.`;
  if (status === 429) return `Could not ${verb}: too many changes at once. Wait a minute and try again.`;
  if (status >= 500) return `Could not ${verb}: the website was busy (${status}). Reload the page to check whether it went through, then try again if it did not.`;
  return `Could not ${verb} (${status}). Try again.`;
}

/** an error thrown while sending, in plain words */
export function plainError(err: unknown, verb: string): string {
  const e = err as Error | undefined;
  if (e?.name === "TimeoutError" || e?.name === "AbortError") {
    return `Could not ${verb}: it took too long. Check your internet connection, reload the page to see whether it went through, then try again if it did not.`;
  }
  if (e instanceof TypeError && /fetch|network|load failed/i.test(e.message)) return `Could not ${verb}: no connection to the website. Check your internet connection and try again.`;
  return e?.message || `Could not ${verb}. Try again.`;
}
