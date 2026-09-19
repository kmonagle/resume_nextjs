// Why this file exists: the footer's "Served by: ..." line. With the local
// implementation the name is known instantly and rendered on the server. With a
// remote backend, finding it out means asking that backend, which may be asleep
// (about a minute on Render's free tier). Waiting for that on the server would
// delay EVERY page, so the browser asks after the page has loaded instead, and
// the line fills in when the answer arrives.
"use client";

import { useQuery } from "@tanstack/react-query";

type Meta = { implementation: string; contractVersion: string };

async function fetchMeta(): Promise<Meta> {
  const response = await fetch("/api/meta");
  if (!response.ok) throw new Error(`meta ${response.status}`);
  return response.json();
}

export function ServedBy({ initial }: { initial: Meta | null }) {
  const { data } = useQuery({
    queryKey: ["meta"],
    queryFn: fetchMeta,
    initialData: initial ?? undefined,
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
