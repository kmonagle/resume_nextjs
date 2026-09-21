// Why this file exists: the SERVER half of the dashboard. It fetches the first
// snapshot of links during server rendering, so the page arrives with data
// already in it (no spinner), then hands it to the client component that
// keeps it live.
//
// With a remote backend on Render's free tier the backend may be ASLEEP (about
// a minute to wake), so this must never hang or crash the page over it: it
// waits a few seconds, and if the backend hasn't answered it renders the table
// in a "waking up" state and lets the browser keep trying.
import { getLinkApi } from "@/server/link-api";
import { BackendUnavailableError } from "@/server/link-api/types";
import { readVisitorId } from "@/server/visitor";
import { withTimeout } from "@/server/with-timeout";
import { toLinkDto, type LinkDto } from "@/shared/lib/link-dto";
import { LinksTable } from "./links-table";

// How long the server waits for the backend before handing over to the browser.
const SSR_WAIT_MS = 6000;

export async function LinksList() {
  // cookies() (inside readVisitorId) is a request-time API, so this route is
  // rendered per request and never frozen at build time with stale data.
  const ownerId = await readVisitorId();
  if (!ownerId) return <LinksTable initialLinks={[]} />;

  // The try/catch wraps only the DATA fetch (React's lint rule rightly says a try/catch can't
  // catch errors from rendering JSX, so JSX is built after it).
  let links: LinkDto[] | null;
  try {
    const records = await withTimeout(getLinkApi().listLinks(ownerId), SSR_WAIT_MS);
    // Only plain JSON-safe data can cross from a Server to a Client Component;
    // a Date would not, which is why we pass DTOs with ISO strings.
    links = records.map((link) => toLinkDto(link));
  } catch (error) {
    // Slow or unreachable backend: not an error worth a red page. `null` tells
    // the table "no data yet": it shows a waking-up message and the browser
    // polls /api/links until the backend answers.
    if (!(error instanceof BackendUnavailableError)) {
      throw error; // a genuine bug should still reach error.tsx
    }
    links = null;
  }

  return <LinksTable initialLinks={links} />;
}
