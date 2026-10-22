"use client";

import { GitPullRequest, LayoutDashboard, LogIn, LogOut, Menu, ScanSearch, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getMe, signOut } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { Skeleton } from "./states";

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

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md">
      <span className="flex size-7 items-center justify-center rounded-md border border-line bg-surface">
        <ScanSearch aria-hidden className="size-4 text-accent" />
      </span>
      <span className="font-mono text-sm font-semibold tracking-tight text-fg">reviewpal</span>
    </Link>
  );
}

// The signed-in user, with a Sign out button
function UserMenu() {
  const { data: me, loading } = useApi("me", getMe);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSignOut() {
    setSigningOut(true);
    setError(undefined);
    try {
      await signOut(); // goes to /sign-in when done
    } catch {
      setSigningOut(false);
      setError("Couldn't sign out. Try again.");
    }
  }

  if (loading || !me) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2" aria-hidden>
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    );
  }

  // Demo visitor: no account to sign out of, so offer signing in instead
  if (me.demo) {
    return (
      <div className="px-3">
        <p className="text-sm text-fg">Demo visitor</p>
        <p className="font-mono text-xs text-muted">read-only</p>
        <a
          href="/auth/exit-demo"
          className="mt-3 inline-flex items-center gap-2 rounded-md text-sm text-accent transition-colors duration-150 hover:text-amber-300"
        >
          <LogIn aria-hidden className="size-4" />
          Sign in
        </a>
      </div>
    );
  }

  return (
    <div className="px-3">
      <div className="flex items-center gap-2.5">
        {me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a 24px GitHub avatar doesn't need next/image
          <img src={me.avatarUrl} alt="" width={24} height={24} className="size-6 shrink-0 rounded-full border border-line" />
        ) : (
          <span aria-hidden className="size-6 shrink-0 rounded-full border border-line bg-surface" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-fg">{me.name ?? me.login}</p>
          {me.name && <p className="truncate font-mono text-xs text-muted">{me.login}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="mt-3 inline-flex items-center gap-2 rounded-md text-sm text-muted transition-colors duration-150 hover:text-fg disabled:opacity-60"
      >
        <LogOut aria-hidden className="size-4" />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
      {error && <p role="status" className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
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
        <div className="mt-auto border-t border-line pt-4">
          <UserMenu />
        </div>
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
            <div className="mt-3 border-t border-line pt-3">
              <UserMenu />
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
