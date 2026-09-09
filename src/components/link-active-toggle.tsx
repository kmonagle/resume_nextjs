"use client";

import { useState, useTransition } from "react";
import { setLinkActiveAction } from "@/server/actions/link-actions";

export function LinkActiveToggle({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      const result = await setLinkActiveAction(id, !isActive);
      setError(result.status === "error" ? result.error : null);
    });
  }

  return (
    <div>
      <button
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
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
