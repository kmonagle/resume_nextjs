// Why this file exists: the footer's "Served by: ..." line, which names the
// backend that answered. Finding that out means asking the backend, which may be
// asleep (about a minute on Render's free tier). Waiting for that on the server
// would delay EVERY page, so the browser asks after the page has loaded instead,
// and the line fills in when the answer arrives.
"use client";

import { useQuery } from "@tanstack/react-query";

type Meta = { implementation: string; contractVersion: string };

async function fetchMeta(): Promise<Meta> {
  const response = await fetch("/api/meta");
  if (!response.ok) throw new Error(`meta ${response.status}`);
  return response.json();
}

export function ServedBy() {
  const { data } = useQuery({
    queryKey: ["meta"],
    queryFn: fetchMeta,
    // Changes only on redeploy, so unlike the links list there is no polling
    // and a long staleTime.
    staleTime: 5 * 60_000,
    retry: false,
  });

  return (
    <footer className="mx-auto max-w-3xl px-6 py-8 text-xs text-zinc-500">
      {data
        ? `Served by: ${data.implementation} · API contract v${data.contractVersion}`
        : "Served by: …"}
    </footer>
  );
}
