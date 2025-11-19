"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Waves,
  FileBarChart2,
  MessageSquare,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const ICONS = {
  dashboard: LayoutDashboard,
  customers: Users,
  appointments: CalendarDays,
  messaging: MessageSquare,
  voice: Waves,
  reports: FileBarChart2,
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
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              buttonVariants({
                variant: isActive ? "default" : "ghost",
                size: "lg",
              }),
              "justify-start gap-3 transition-all",
              collapsed ? "px-3" : "px-4",
              isActive
                ? "shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {Icon ? <Icon className="size-4" /> : null}
            <span className={cn("text-sm font-medium", collapsed && "sr-only")}>{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
