// Why this file exists: the home page form for creating a short link. It runs
// a Server Action (no fetch code), shows per-field validation errors, and
// tells react-query the cached link list is now out of date.
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createLinkAction,
  type CreateLinkState,
} from "@/server/actions/link-actions";
import { LINK_RETENTION_DAYS } from "@/shared/lib/demo-limits";
import { LINKS_QUERY_KEY } from "@/shared/lib/query-keys";

const initialState: CreateLinkState = { status: "idle" };

// Read at BUILD time: Next inlines NEXT_PUBLIC_* values into the browser
// bundle, so changing it needs a rebuild. (It is public, which is why it is
// safe to expose; never use the prefix for secrets.)
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

// useFormStatus reads the status of the nearest PARENT <form>, so it only
// works in a component rendered inside the form, never in the component that
// renders the <form> itself. That is why the button is its own component.
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      type="submit"
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="text-xs text-red-600 dark:text-red-400">
      {messages[0]}
    </p>
  );
}

export function CreateLinkForm() {
  const [state, formAction] = useActionState(createLinkAction, initialState);
  const queryClient = useQueryClient();

  // A <input type="datetime-local"> yields a timezone-less string like
  // "2026-10-01T09:30", and the server cannot know the visitor's timezone.
  // So the visible input has no `name` (it is not submitted); a hidden input
  // carries the same moment as an unambiguous UTC ISO string instead.
  const [expiresLocal, setExpiresLocal] = useState("");
  const expiresIso = expiresLocal
    ? new Date(expiresLocal).toISOString()
    : "";

  // When a create succeeds, the cached dashboard list is out of date. Marking
  // it stale is enough: the dashboard is not mounted right now, so nothing
  // refetches yet, and the next visit fetches fresh data.
  useEffect(() => {
    if (state.status === "success") {
      void queryClient.invalidateQueries({ queryKey: LINKS_QUERY_KEY });
    }
  }, [state, queryClient]);

  const values = state.status === "error" ? state.values : undefined;
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  return (
    <div>
      <h1 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Create a short link
      </h1>
      <form
        action={formAction}
        className="mt-6 flex max-w-md flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
      >
        <label className="flex flex-col gap-1 text-sm">
          Destination URL
          <input
            type="text"
            name="targetUrl"
            placeholder="https://example.com/some/long/url"
            // React 19 resets uncontrolled fields after every action; the
            // action echoes what was typed so an error does not wipe the form.
            defaultValue={values?.targetUrl}
            className={inputClass}
          />
          <FieldError messages={fieldErrors.targetUrl} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Title <span className="text-zinc-500">(optional)</span>
          <input
            type="text"
            name="title"
            defaultValue={values?.title}
            className={inputClass}
          />
          <FieldError messages={fieldErrors.title} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Custom code <span className="text-zinc-500">(optional)</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-zinc-500">/r/</span>
            <input
              type="text"
              name="shortCode"
              placeholder="my-promo"
              defaultValue={values?.shortCode}
              className={`${inputClass} flex-1 font-mono`}
            />
          </span>
          <FieldError messages={fieldErrors.shortCode} />
        </label>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Max clicks <span className="text-zinc-500">(optional)</span>
            <input
              type="number"
              name="maxClicks"
              min={1}
              defaultValue={values?.maxClicks}
              className={inputClass}
            />
            <FieldError messages={fieldErrors.maxClicks} />
          </label>

          <label className="flex flex-1 flex-col gap-1 text-sm">
            Expires <span className="text-zinc-500">(optional)</span>
            <input
              type="datetime-local"
              value={expiresLocal}
              onChange={(event) => setExpiresLocal(event.target.value)}
              className={inputClass}
            />
            <input type="hidden" name="expiresAt" value={expiresIso} />
            <FieldError messages={fieldErrors.expiresAt} />
          </label>
        </div>

        <SubmitButton />

        {state.status === "success" && (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Created:{" "}
            <a
              href={`${BASE_URL}/r/${state.shortCode}`}
              className="font-mono font-medium text-zinc-900 underline dark:text-zinc-50"
            >
              {BASE_URL}/r/{state.shortCode}
            </a>
          </p>
        )}
        {state.status === "error" && state.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        <p className="text-xs text-zinc-500">
          Demo: links are private to this browser and deleted after{" "}
          {LINK_RETENTION_DAYS} days.
        </p>
      </form>
    </div>
  );
}
