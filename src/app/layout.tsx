// Why this file exists: the root layout wraps every page. It loads fonts, sets
// site metadata, mounts the client-side providers, and renders the shared nav
// and footer. It stays a Server Component; client behaviour lives in Providers.
import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Nav } from "@/components/nav";
import { Providers } from "@/components/providers";
import { getImplementation } from "@/server/link-api/implementation";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "NextJS Links",
  description: "Create and track short links, implemented in NextJS.",
};

// LayoutProps is a typed helper Next generates from the app/ folder structure
// (see `next typegen`), so `children` and any parallel slots are typed for us.
export default function RootLayout({ children }: LayoutProps<"/">) {
  const implementation = getImplementation();
  return (
    <html lang="en">
      <body
        className={`${plexSans.variable} ${plexMono.variable} font-sans bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50`}
      >
        <Providers>
          <Nav />
          {children}
          <footer className="mx-auto max-w-3xl px-6 py-8 text-xs text-zinc-500">
            Served by: {implementation.name} · API contract v
            {implementation.contractVersion}
          </footer>
        </Providers>
      </body>
    </html>
  );
}
