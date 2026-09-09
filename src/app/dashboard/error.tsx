"use client";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-sm text-red-600 dark:text-red-400">
        Something went wrong loading your links.
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
