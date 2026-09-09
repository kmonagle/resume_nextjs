"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createLinkAction,
  type CreateLinkState,
} from "@/server/actions/link-actions";

const initialState: CreateLinkState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      type="submit"
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900
  dark:hover:bg-zinc-300"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function CreateLinkForm() {
  const [state, formAction] = useActionState(createLinkAction, initialState);

  return (
    <div>
      <h1 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Create a short link
      </h1>
      <form
        action={formAction}
        className="mt-6 flex max-w-md flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
      >
        <input
          type="text"
          name="targetUrl"
          placeholder="https://example.com/some/long/url"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <SubmitButton />
        {state.status === "success" && (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Created:{" "}
            <a
              href={`${process.env.NEXT_PUBLIC_BASE_URL}/r/${state.shortCode}`}
              className="font-mono font-medium text-zinc-900 underline dark:text-zinc-50"
            >
              {process.env.NEXT_PUBLIC_BASE_URL}/r/{state.shortCode}
            </a>
          </p>
        )}
        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}
