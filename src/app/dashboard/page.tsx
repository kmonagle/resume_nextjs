// Why this file exists: the /dashboard route. Suspense shows a lightweight
// fallback while the server component below fetches the links.
import { Suspense } from "react";
import { LinksList } from "@/components/links-list";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Suspense
        fallback={<p className="text-sm text-zinc-500">Loading links…</p>}
      >
        <LinksList />
      </Suspense>
    </main>
  );
}
