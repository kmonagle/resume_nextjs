// Why this file exists: React context providers must be Client Components, but
// the root layout should stay a Server Component. So the layout renders this
// small client wrapper, and everything under it can use react-query.
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  // Created inside useState, never at module level. A module-level client
  // would be one instance shared by every visitor's server-side render (their
  // cached data would bleed together); useState gives each browser session its
  // own client, created once and kept across re-renders.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
