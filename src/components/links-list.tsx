// Why this file exists: the SERVER half of the dashboard. It fetches the first
// snapshot of links during server rendering, so the page arrives with data
// already in it (no spinner), then hands it to the client component that
// keeps it live.
import { getLinkApi } from "@/server/link-api";
import { readVisitorId } from "@/server/visitor";
import { toLinkDto } from "@/shared/lib/link-dto";
import { LinksTable } from "./links-table";

export async function LinksList() {
  // cookies() (inside readVisitorId) is a request-time API, so this route is
  // rendered per request and never frozen at build time with stale data.
  const ownerId = await readVisitorId();
  const links = ownerId ? await getLinkApi().listLinks(ownerId) : [];

  // Only plain JSON-safe data can cross from a Server to a Client Component;
  // a Date would not, which is why we pass DTOs with ISO strings.
  return <LinksTable initialLinks={links.map((link) => toLinkDto(link))} />;
}
