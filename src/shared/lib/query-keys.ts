// Why this file exists: react-query identifies cached data by "query key".
// The table that reads the links and the components that invalidate them must
// use the identical key, so it is defined once here (and not inside either
// component, which would make them import each other).
export const LINKS_QUERY_KEY = ["links"] as const;
