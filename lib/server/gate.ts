/**
 * A concurrency gate for model calls on this server. Hosted Gemma has per-key
 * rate limits and a local GPU can only run so much at once, so at most
 * `limit` calls run together; the rest wait in a FIFO queue, and a call that
 * waits too long fails fast with BusyError (the route answers 503 + Retry-After)
 * instead of piling up behind a slow provider.
 */
export class BusyError extends Error {
  constructor(public retryAfterS: number) {
    super("The model is busy. Try again in a moment.");
  }
}

export function createGate(limit: number, maxWaitMs: number) {
  let active = 0;
  const queue: {
    resolve: () => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }[] = [];
  const release = () => {
    const next = queue.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve(); // the slot passes straight to the next caller
    } else active--;
  };
  return {
    async run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      if (active < limit) active++;
      else
        await new Promise<void>((resolve, reject) => {
          const entry = {
            resolve,
            reject,
            timer: setTimeout(() => {
              queue.splice(queue.indexOf(entry), 1);
              reject(new BusyError(Math.ceil(maxWaitMs / 1000)));
            }, maxWaitMs),
          };
          queue.push(entry);
          signal?.addEventListener("abort", () => {
            const i = queue.indexOf(entry);
            if (i < 0) return;
            queue.splice(i, 1);
            clearTimeout(entry.timer);
            reject(new Error("aborted"));
          });
        });
      try {
        return await fn();
      } finally {
        release();
      }
    },
    stats: () => ({ active, queued: queue.length, limit }),
  };
}
