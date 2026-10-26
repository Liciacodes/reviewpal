"use client";

import { ExternalLink, PackagePlus } from "lucide-react";
import { getMe } from "@/lib/api";
import { useApi } from "@/lib/use-api";

// "Install ReviewPal on your repos": opens the GitHub App's install page (from /api/me).
// Shows nothing until that address is known, or if the API couldn't ask GitHub for it.
// Installing changes nothing in ReviewPal's data, so demo visitors see it too.
export function InstallButton({ variant = "button" }: { variant?: "button" | "link" }) {
  const { data: me } = useApi("me", getMe);
  if (!me?.installUrl) return null;

  const className =
    variant === "button"
      ? "inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-canvas transition-colors duration-150 hover:bg-amber-300"
      : "inline-flex items-center gap-2 rounded-md text-sm text-accent transition-colors duration-150 hover:text-amber-300";

  return (
    <a href={me.installUrl} target="_blank" rel="noreferrer" className={className}>
      <PackagePlus aria-hidden className="size-4" />
      Install ReviewPal on your repos
      {variant === "button" && <ExternalLink aria-hidden className="size-3.5" />}
      <span className="sr-only">(opens GitHub in a new tab)</span>
    </a>
  );
}
