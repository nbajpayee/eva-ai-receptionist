import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
        <div className="min-h-screen">
          <header className="border-b bg-white/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
              <div className="flex flex-col">
                <span className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                  Ava Command Center
                </span>
                <h1 className="text-xl font-semibold text-zinc-900">
                  Med Spa Voice Operations
                </h1>
                <nav className="flex items-center gap-6 text-sm text-zinc-500">
                  <a className="transition hover:text-zinc-900" href="/">
                    Dashboard
                  </a>
                  <a className="transition hover:text-zinc-900" href="/appointments">
                    Appointments
                  </a>
                  <a className="transition hover:text-zinc-900" href="/voice">
                    Voice console
                  </a>
                  <a className="transition hover:text-zinc-900" href="/reports">
                    Reports
                  </a>
                </nav>
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
