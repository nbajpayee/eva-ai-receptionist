"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { SidebarNav, type SidebarNavItem } from "@/components/ui/sidebar-nav";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { UserNav } from "@/components/layout/user-nav";
import { useAuth } from "@/contexts/auth-context";

interface AppShellProps {
  children: React.ReactNode;
  navItems: SidebarNavItem[];
}

export function AppShell({ children, navItems }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    if (!loading && !user && !isLoginRoute) {
      const redirect = pathname || "/";
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
    }
  }, [loading, user, isLoginRoute, pathname, router]);

  // Auth-only layout: no sidebar or header; let the login page define its own layout
  if (isLoginRoute) {
    return <>{children}</>;
  }

  // While auth state is loading on protected routes, show a minimal loading shell
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100/60">
        <span className="text-sm text-zinc-500">Loading...</span>
      </div>
    );
  }

  // If not authenticated on a non-login route, don't render the dashboard content
  // The useEffect above will handle redirecting to the login page.
  if (!user) {
    return null;
  }

  // Default dashboard layout with sidebar and header
  return (
    <div className="flex min-h-screen bg-zinc-100/60">
      <aside className="hidden border-r border-zinc-200 bg-white/80 backdrop-blur lg:flex lg:w-64 lg:flex-col">
        <div className="flex h-20 flex-col justify-center gap-1 border-b border-zinc-200 px-6">
          <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Eva Command Center
          </span>
          <span className="text-sm font-semibold text-zinc-900">
            Med Spa Voice Operations
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-6 px-4 py-6">
          <SidebarNav items={navItems} />
          <div className="mt-auto rounded-lg border border-zinc-200 bg-white/80 p-4 text-xs text-zinc-500">
            Monitor live voice traffic, appointments, and operational health for your teams.
          </div>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur">
          <div className="lg:hidden">
            <MobileSidebar items={navItems} />
          </div>
          <div className="hidden lg:flex flex-col items-start">
            <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Eva Command Center
            </span>
            <span className="text-sm font-semibold text-zinc-900">
              Med Spa Voice Operations
            </span>
          </div>
          <div className="flex items-center gap-4 lg:ml-auto">
            <UserNav />
          </div>
          <div className="flex lg:hidden flex-col items-end">
            <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Eva Command Center
            </span>
            <span className="text-sm font-semibold text-zinc-900">
              Med Spa Voice Operations
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-6xl space-y-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
