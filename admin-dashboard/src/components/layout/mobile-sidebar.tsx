"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav, type SidebarNavItem } from "@/components/ui/sidebar-nav";

export function MobileSidebar({ items }: { items: SidebarNavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="-ml-1 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 gap-6 border-r bg-white/95 backdrop-blur">
        <SheetHeader className="items-start gap-1">
          <SheetTitle className="text-left text-sm uppercase tracking-[0.3em] text-zinc-500">
            Ava Command Center
          </SheetTitle>
        </SheetHeader>
        <SidebarNav items={items} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
