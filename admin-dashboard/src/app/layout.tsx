import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { SidebarNav, type SidebarNavItem } from "@/components/ui/sidebar-nav";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { ToastProviderWrapper } from "@/components/providers/toast-provider-wrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const NAV_ITEMS: SidebarNavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: "dashboard",
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: "reports",
  },
  {
    title: "Customers",
    href: "/customers",
    icon: "customers",
  },
  {
    title: "Appointments",
    href: "/appointments",
    icon: "appointments",
  },
  {
    title: "Messaging",
    href: "/messaging",
    icon: "messaging",
  },
  {
    title: "Voice",
    href: "/voice",
    icon: "voice",
  },
  {
    title: "Research",
    href: "/research",
    icon: "reports",
  },
  {
    title: "Consultation",
    href: "/consultation",
    icon: "consultation",
  },
  {
    title: "Providers",
    href: "/providers",
    icon: "providers",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: "dashboard",
  },
  {
    title: "Console Reports",
    href: "/reports",
    icon: "reports",
  },
];

export const metadata: Metadata = {
  title: "Ava Admin Dashboard",
  description:
    "Internal analytics and call insights for the Ava Med Spa voice assistant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-50 text-zinc-900 antialiased`}
      >
        <ToastProviderWrapper>
          <div className="flex min-h-screen bg-zinc-100/60">
          <aside className="hidden border-r border-zinc-200 bg-white/80 backdrop-blur lg:flex lg:w-64 lg:flex-col">
            <div className="flex h-20 flex-col justify-center gap-1 border-b border-zinc-200 px-6">
              <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Ava Command Center
              </span>
              <span className="text-sm font-semibold text-zinc-900">
                Med Spa Voice Operations
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-6 px-4 py-6">
              <SidebarNav items={NAV_ITEMS} />
              <div className="mt-auto rounded-lg border border-zinc-200 bg-white/80 p-4 text-xs text-zinc-500">
                Monitor live voice traffic, appointments, and operational health for your teams.
              </div>
            </div>
          </aside>
          <div className="flex flex-1 flex-col">
            <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur lg:hidden">
              <MobileSidebar items={NAV_ITEMS} />
              <div className="flex flex-col items-end">
                <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  Ava Command Center
                </span>
                <span className="text-sm font-semibold text-zinc-900">
                  Med Spa Voice Operations
                </span>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-10">
              <div className="mx-auto w-full max-w-6xl space-y-8">
                {children}
              </div>
            </main>
          </div>
        </div>
        </ToastProviderWrapper>
      </body>
    </html>
  );
}
