// Why this file exists: Next renders this when anything under /dashboard throws
// (for example the database is unreachable), instead of a blank page. It must
// be a Client Component. `retry` re-fetches and re-renders the failed segment
// (the prop is named `retry` in Next 16.3; older versions called it `reset`).
"use client";

export default function DashboardError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-sm text-red-600 dark:text-red-400">
        Something went wrong loading your links. If you have just been idle, the
        backend may still be waking up; try again in a moment.
      </p>
      <button
        onClick={() => retry()}
        className="mt-4 text-sm text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-50"
      >
        Try again
      </button>
    </div>
  );
}
