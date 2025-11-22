import type { Metadata } from "next";
import "./globals.css";

import type { SidebarNavItem } from "@/components/ui/sidebar-nav";
import { ToastProviderWrapper } from "@/components/providers/toast-provider-wrapper";
import { AuthProvider } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/app-shell";

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
      <body className="bg-zinc-50 text-zinc-900 antialiased">
        <AuthProvider>
          <ToastProviderWrapper>
            <AppShell navItems={NAV_ITEMS}>{children}</AppShell>
          </ToastProviderWrapper>
        </AuthProvider>
      </body>
      </html>
  );
}
