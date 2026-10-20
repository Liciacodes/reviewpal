"use client";

import { GitPullRequest, LayoutDashboard, Menu, ScanSearch, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/reviews", label: "Reviews", icon: GitPullRequest },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                active ? "bg-surface text-fg" : "text-muted hover:bg-surface/60 hover:text-fg"
              }`}
            >
              <Icon aria-hidden className={`size-4 ${active ? "text-accent" : ""}`} />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// usePathname must sit inside <Suspense> in this Next.js version (dynamic routes like /reviews/[id])
function ActiveNavLinks(props: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} {...props} />;
}

function Nav(props: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavLinks pathname={null} {...props} />}>
      <ActiveNavLinks {...props} />
    </Suspense>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md">
      <span className="flex size-7 items-center justify-center rounded-md border border-line bg-surface">
        <ScanSearch aria-hidden className="size-4 text-accent" />
      </span>
      <span className="font-mono text-sm font-semibold tracking-tight text-fg">reviewpal</span>
    </Link>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  // Close the mobile menu with Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Desktop: fixed left sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-canvas px-4 py-6 md:flex">
        <div className="px-3"><Logo /></div>
        <nav aria-label="Main" className="mt-10">
          <Nav />
        </nav>
      </aside>

      {/* Mobile: top bar with a menu button */}
      <div className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface hover:text-fg"
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Main" className="border-t border-line px-4 py-3">
            <Nav onNavigate={() => setOpen(false)} />
          </nav>
        )}
      </div>
    </>
  );
}
