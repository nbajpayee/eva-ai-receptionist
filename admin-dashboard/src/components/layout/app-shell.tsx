"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { SidebarNav, type SidebarNavItem } from "@/components/ui/sidebar-nav";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { UserNav } from "@/components/layout/user-nav";
import { useAuth } from "@/contexts/auth-context";
import { Sparkles } from "lucide-react";

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

  // Auth-only layout
  if (isLoginRoute) {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-sky-500" />
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Loading Eva...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-zinc-50/50 selection:bg-sky-100 selection:text-sky-900">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute left-0 top-0 h-[500px] w-[500px] -translate-x-[30%] -translate-y-[20%] rounded-full bg-sky-200/20 blur-[100px]" />
        <div className="absolute right-0 bottom-0 h-[500px] w-[500px] translate-x-[20%] translate-y-[20%] rounded-full bg-blue-200/20 blur-[100px]" />
      </div>

      {/* Sidebar (Desktop) */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-white/40 bg-white/60 backdrop-blur-xl lg:flex">
        <div className="flex h-20 items-center px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-zinc-900 tracking-tight">Eva Admin</span>
              <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Command Center</span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-6 px-4 py-6">
          <SidebarNav items={navItems} />
          
          <div className="mt-auto">
            <div className="rounded-2xl border border-white/50 bg-gradient-to-br from-white/50 to-white/20 p-4 shadow-sm backdrop-blur-md">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-zinc-700">System Operational</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Voice traffic is normal. All systems are running optimally.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/40 bg-white/60 px-6 backdrop-blur-xl transition-all">
          <div className="flex items-center gap-4 lg:hidden">
            <MobileSidebar items={navItems} />
            <span className="text-sm font-bold text-zinc-900">Eva Admin</span>
          </div>

          <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-between">
             {/* Breadcrumb or Page Title placeholder */}
             <div className="flex items-center gap-2 text-sm text-zinc-500">
                <span className="font-medium text-zinc-900">Dashboard</span>
                <span className="text-zinc-300">/</span>
                <span>Overview</span>
             </div>
          </div>

          <div className="flex items-center gap-4">
            <UserNav />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="container mx-auto max-w-7xl p-6 lg:p-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
