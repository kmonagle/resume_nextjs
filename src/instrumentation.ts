// Why this file exists: Next runs `register()` once when the server process
// starts. With a remote backend on Render's free tier BOTH services sleep, and
// waking them one after the other doubles the wait (Next wakes, THEN calls the
// backend, which wakes). Pinging the backend from here starts its wake-up while
// Next is still booting, so the two cold starts overlap.
export function register() {
  // instrumentation also loads in the Edge runtime, which cannot use this.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.LINK_BACKEND !== "remote" || !process.env.LINK_BACKEND_URL) {
    return;
  }

  // Fire and forget, deliberately NOT awaited: Next waits for register() to
  // finish before it accepts requests, so awaiting a sleeping backend would
  // block this whole server from starting. Failure is fine; it is only a nudge.
  const url = `${process.env.LINK_BACKEND_URL.replace(/\/+$/, "")}/meta`;
  fetch(url, { cache: "no-store" }).catch(() => {});
}
