// Why this file exists: the enable/disable button on each dashboard row. It
// calls a Server Action directly and then refreshes the live table.
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";

import { setLinkActiveAction } from "@/server/actions/link-actions";
import { LINKS_QUERY_KEY } from "@/shared/lib/query-keys";

export function LinkActiveToggle({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  // useTransition marks the async action as a low-priority update and gives us
  // `isPending`, without blocking the rest of the UI while the server works.
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(
    null,
  );
  const queryClient = useQueryClient();

  function handleClick() {
    startTransition(async () => {
      const result = await setLinkActiveAction(id, !isActive);
      setError(
        result.status === "error"
          ? { message: result.error, retryable: result.retryable === true }
          : null,
      );
      // Mark the list stale so the new state shows now, not at the next poll.
      if (result.status === "success") {
        await queryClient.invalidateQueries({ queryKey: LINKS_QUERY_KEY });
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-zinc-500 underline hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-50"
      >
        {isPending
          ? isActive
            ? "Deactivating…"
            : "Activating…"
          : isActive
            ? "Deactivate"
            : "Activate"}
      </button>
      {error && (
        // Amber for "the backend is waking up, try again", red for real errors.
        <p
          role="alert"
          className={
            error.retryable
              ? "text-xs text-amber-600 dark:text-amber-400"
              : "text-xs text-red-600 dark:text-red-400"
          }
        >
          {error.message}
        </p>
      )}
    </div>
  );
}
