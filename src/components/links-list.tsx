import Link from "next/link";
import { findAllLinks } from "@/server/repositories/link-repository";
import { getLinkStatus, type LinkStatus } from "@/shared/lib/link-status";
import { LinkActiveToggle } from "./link-active-toggle";

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

export async function LinksList() {
  const links = await findAllLinks();
  const activeCount = links.filter(
    (link) => getLinkStatus(link) === "active",
  ).length;

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Links
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">{activeCount} active</span>
          <Link
            href="/"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            New link
          </Link>
        </div>
      </div>

      {links.length === 0 ? (
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
                <th className="py-3 font-normal" scope="col">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const status = getLinkStatus(link);
                return (
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
                    </td>
                    <td className="py-3">
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`}
                        />
                        {STATUS_LABEL[status]}
                      </span>
                      <LinkActiveToggle id={link.id} isActive={link.isActive} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
