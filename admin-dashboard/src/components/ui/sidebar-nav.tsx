"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Waves,
  FileBarChart2,
  MessageSquare,
  Stethoscope,
  UserCog,
  Users,
  type LucideIcon,
  Settings,
  FlaskConical,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const ICONS = {
  dashboard: LayoutDashboard,
  customers: Users,
  appointments: CalendarDays,
  messaging: MessageSquare,
  consultation: Stethoscope,
  providers: UserCog,
  voice: Waves,
  reports: FileBarChart2,
  research: FlaskConical,
  settings: Settings,
  components: Palette,
} satisfies Record<string, LucideIcon>;

export type SidebarNavIconKey = keyof typeof ICONS;

export type SidebarNavItem = {
  title: string;
  href: string;
  icon: SidebarNavIconKey;
};

export function SidebarNav({
  items,
  collapsed,
  onNavigate,
}: {
  items: SidebarNavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1.5">
      {items.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        const Icon = ICONS[item.icon] || LayoutDashboard;
        
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
              isActive
                ? "text-sky-700 bg-sky-50/80"
                : "text-zinc-500 hover:bg-white/60 hover:text-zinc-900 hover:shadow-sm"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="active-sidebar-item"
                className="absolute inset-0 rounded-xl bg-white shadow-sm ring-1 ring-zinc-200/50"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
              >
                 <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sky-500" />
              </motion.div>
            )}
            
            <span className="relative z-10 flex items-center gap-3">
              <Icon className={cn("size-4 transition-colors", isActive ? "text-sky-600" : "text-zinc-400 group-hover:text-zinc-600")} />
              <span className={cn(collapsed && "sr-only")}>{item.title}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
