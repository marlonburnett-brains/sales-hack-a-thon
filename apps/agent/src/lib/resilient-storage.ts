/**
 * Resilient PostgresStore wrapper
 *
 * Wraps a PostgresStore instance so that transient failures during init()
 * (DNS resolution, connection timeouts, etc.) don't crash the process.
 * Instead, init is retried with exponential backoff.
 *
 * Why this exists:
 *   @mastra/core wraps every storage instance with `augmentWithInit`, a Proxy
 *   that lazily calls `storage.init()` before the first storage operation and
 *   caches the resulting promise in a local `hasInitialized` variable.
 *
 *   If init() rejects (e.g. DNS ENOTFOUND), the MastraError propagates as an
 *   unhandled rejection and kills the Node process.  Worse, the proxy caches
 *   the rejected promise, so even if connectivity recovers, every subsequent
 *   storage operation re-throws the same cached rejection.
 *
 *   We cannot modify the library code, so we intercept init() at the boundary.
 *   Our patched init() retries internally on transient errors and only resolves
 *   (never rejects) for transient issues, keeping the proxy's cached promise
 *   alive until init succeeds.
 */

import { PostgresStore } from "@mastra/pg";

const MAX_RETRIES = 12;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

function backoffDelay(attempt: number): number {
  const exponential = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * BASE_DELAY_MS;
  return Math.min(exponential + jitter, MAX_DELAY_MS);
}

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = (err.message || "").toLowerCase();
  const cause = (err as { cause?: { code?: string } }).cause;
  const code = (
    cause?.code ||
    (err as { code?: string }).code ||
    ""
  ).toUpperCase();

  return (
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ETIMEOUT" ||
    msg.includes("enotfound") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("timeout") ||
    msg.includes("connection terminated") ||
    msg.includes("too many clients") ||
    msg.includes("remaining connection slots") ||
    msg.includes("could not connect")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a PostgresStore whose init() retries on transient connectivity
 * failures instead of crashing the process.
 *
 * IMPORTANT: The returned init() only rejects for non-transient errors
 * (e.g. bad credentials, missing schema).  For transient errors it keeps
 * retrying until MAX_RETRIES is exhausted, then rejects.
 */
export function createResilientStorage(
  config: ConstructorParameters<typeof PostgresStore>[0],
): PostgresStore {
  const store = new PostgresStore(config);

  const originalInit = store.init.bind(store);

  // We replace init() with a version that retries transient failures.
  // The augmentWithInit proxy in @mastra/core will call this once and
  // cache the returned promise.  As long as our promise eventually
  // resolves, the proxy stays healthy.
  store.init = async function resilientInit(): Promise<void> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await originalInit();
        if (attempt > 0) {
          console.log(
            `[resilient-storage] init succeeded after ${attempt + 1} attempts`,
          );
        }
        return;
      } catch (err: unknown) {
        if (!isTransientError(err) || attempt === MAX_RETRIES) {
          console.error(
            `[resilient-storage] init failed permanently` +
              ` (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
            err instanceof Error ? err.message : err,
          );
          throw err;
        }

        const delay = backoffDelay(attempt);
        console.warn(
          `[resilient-storage] init failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}, ` +
            `retry in ${Math.round(delay)}ms): ` +
            `${err instanceof Error ? err.message : err}`,
        );
        await sleep(delay);
      }
    }
  };

  return store;
}
