"use client";

import { useState } from "react";
import { createLinkSchema } from "@/shared/schemas/link-schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function CreateLinkForm() {
  const [targetUrl, setTargetUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: { targetUrl: string }) => {
      const result = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (result.ok) {
        return result.json();
      } else {
        throw new Error("Failed to create link");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
    },
  });

  function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    const parsed = createLinkSchema.safeParse({ targetUrl });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Invalid URL");
    } else {
      setValidationError(null);
      mutation.mutate(parsed.data);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Create a short link
        </h1>
        <input
          type="text"
          placeholder="https://example.com/some/long/url"
          value={targetUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setTargetUrl(e.currentTarget.value);
          }}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          disabled={mutation.isPending}
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </button>
        {mutation.isSuccess && mutation.data && (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Created:{" "}
            <a
              href={`${process.env.NEXT_PUBLIC_BASE_URL}/r/${mutation.data.shortCode}`}
              className="font-medium text-zinc-900 underline dark:text-zinc-50"
            >
              {process.env.NEXT_PUBLIC_BASE_URL}/r/{mutation.data.shortCode}
            </a>
          </p>
        )}
        {mutation.isError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {mutation.error.message}
          </p>
        )}
        {validationError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {validationError}
          </p>
        )}
      </form>
    </div>
  );
}
