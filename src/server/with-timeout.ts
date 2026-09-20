// Why this file exists: lets a page stop WAITING for a slow backend without cancelling the call.
// On Render's free tier a sleeping backend takes up to a minute to answer its first request. The
// dashboard is server-rendered, and blocking the whole page on that would leave the visitor
// staring at nothing. So the server waits a few seconds, then gives up waiting and lets the
// browser take over (which keeps polling until the backend is up).
import { BackendUnavailableError } from "@/server/link-api/types";

/**
 * Resolves with `promise`'s value, or rejects with BackendUnavailableError once `ms` have
 * passed, whichever comes first. The original promise is NOT cancelled: the request to the
 * backend keeps going, which is exactly what wakes a sleeping service.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new BackendUnavailableError("The backend is slow to respond")),
      ms,
    );

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
