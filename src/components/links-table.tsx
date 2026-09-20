// Why this file exists: the CLIENT half of the dashboard. It renders the table
// and keeps click counts live by polling /api/links with react-query. Polling
// (not WebSockets) because Next route handlers cannot upgrade connections and
// a multi-instance deployment would need pub/sub; a 5s poll is stateless.
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import type { LinkDto } from "@/shared/lib/link-dto";
import type { LinkStatus } from "@/shared/lib/link-status";
import { LINKS_QUERY_KEY } from "@/shared/lib/query-keys";
import { LinkActiveToggle } from "./link-active-toggle";

const POLL_INTERVAL_MS = 5000;

const STATUS_LABEL: Record<LinkStatus, string> = {
  active: "Active",
  expired: "Expired",
  max_clicks: "Limit reached",
  disabled: "Disabled",
};

const STATUS_DOT: Record<LinkStatus, string> = {
  active: "bg-green-600",
  expired: "bg-red-600",
  max_clicks: "bg-amber-600",
  disabled: "bg-zinc-400 dark:bg-zinc-600",
};

async function fetchLinks(): Promise<LinkDto[]> {
  const response = await fetch("/api/links", { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load links (${response.status})`);
  return response.json();
}

// `initialLinks` is null when the server couldn't reach the backend in time (see
// links-list.tsx): the table then starts empty, says the backend is waking up, and fills in as
// soon as a poll succeeds.
export function LinksTable({ initialLinks }: { initialLinks: LinkDto[] | null }) {
  const { data, isError } = useQuery({
    queryKey: LINKS_QUERY_KEY,
    queryFn: fetchLinks,
    // Seeds the cache with the server-rendered snapshot so the first paint has
    // data. Gotcha: initialData is only used when the cache has NO entry for
    // this key; if the visitor already loaded the dashboard earlier, the cached
    // data wins. That is why creating a link also invalidates the query.
    initialData: initialLinks ?? undefined,
    // Poll. react-query pauses this while the tab is hidden (unless
    // refetchIntervalInBackground is set), so an abandoned tab costs nothing
    // and does not keep a scale-to-zero database awake.
    refetchInterval: POLL_INTERVAL_MS,
    // staleTime stays at its default of 0: the data is always considered
    // stale, so returning to the page refetches immediately.
  });

  // No data yet at all (the server gave up waiting and no poll has succeeded).
  const waking = data === undefined;
  const links = data ?? [];
  const activeCount = links.filter((link) => link.status === "active").length;

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Links
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">
            {waking ? "…" : `${activeCount} active`}
            {isError && !waking && (
              <span className="ml-2 text-amber-600" role="status">
                · live updates paused
              </span>
            )}
          </span>
          <Link
            href="/"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            New link
          </Link>
        </div>
      </div>

      {waking ? (
        // Amber, not red: this is the expected state of a free-tier backend, not a failure.
        <p className="py-8 text-sm text-amber-600" role="status">
          Waking the backend… this can take up to a minute on the free tier. This page will fill
          in by itself.
        </p>
      ) : links.length === 0 ? (
        <p className="py-8 text-sm text-zinc-500">
          No links yet — create your first one.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="py-3 font-normal" scope="col">
                  Link
                </th>
                <th className="py-3 font-normal" scope="col">
                  Destination
                </th>
                <th className="py-3 text-right font-normal" scope="col">
                  Clicks
                </th>
                <th className="py-3 pl-4 font-normal" scope="col">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr
                  key={link.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="py-3 pr-4">
                    {link.title ? (
                      <>
                        <div className="font-medium text-zinc-900 dark:text-zinc-50">
                          {link.title}
                        </div>
                        <div className="font-mono text-xs text-zinc-500">
                          /r/{link.shortCode}
                        </div>
                      </>
                    ) : (
                      <div className="font-mono text-zinc-900 dark:text-zinc-50">
                        /r/{link.shortCode}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div
                      className="max-w-[240px] truncate font-mono text-zinc-500"
                      title={link.targetUrl}
                    >
                      {link.targetUrl}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-zinc-900 dark:text-zinc-50">
                    {link.clickCount}
                    {link.maxClicks != null && (
                      <span className="text-zinc-500"> / {link.maxClicks}</span>
                    )}
                  </td>
                  <td className="py-3 pl-4">
                    <span className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[link.status]}`}
                      />
                      {STATUS_LABEL[link.status]}
                    </span>
                    {link.expiresAt && link.status !== "expired" && (
                      <div className="text-xs text-zinc-500">
                        expires {new Date(link.expiresAt).toLocaleString()}
                      </div>
                    )}
                    <LinkActiveToggle id={link.id} isActive={link.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
