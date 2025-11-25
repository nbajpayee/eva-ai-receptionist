"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, MapPin, Briefcase, Users, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { GeneralSettings } from "@/components/settings/general-settings";
import { LocationsSettings } from "@/components/settings/locations-settings";
import { ServicesSettings } from "@/components/settings/services-settings";
import { ProvidersSettings } from "@/components/settings/providers-settings";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="relative min-h-[800px] w-full overflow-hidden rounded-3xl bg-zinc-50/50 p-6 md:p-10">
        {/* Background Effects matching Login/Shell */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
          <div className="absolute left-0 top-0 h-[500px] w-[500px] -translate-x-[30%] -translate-y-[20%] rounded-full bg-sky-200/20 blur-[100px]" />
          <div className="absolute right-0 bottom-0 h-[500px] w-[500px] translate-x-[20%] translate-y-[20%] rounded-full bg-teal-200/20 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-5xl space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                <span className="bg-gradient-to-r from-sky-500 to-teal-500 bg-clip-text text-transparent">
                  Settings
                </span>
              </h2>
              <p className="text-zinc-500">
                Manage your med spa configuration and preferences
              </p>
            </div>
            <div className="hidden md:flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
              <Sparkles className="h-5 w-5 text-sky-500" />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <div className="rounded-2xl bg-white/40 p-1.5 backdrop-blur-md ring-1 ring-zinc-200/50">
              <TabsList className="grid w-full grid-cols-4 bg-transparent p-0">
                {[
                  { id: "general", label: "General", icon: Settings },
                  { id: "locations", label: "Locations", icon: MapPin },
                  { id: "services", label: "Services", icon: Briefcase },
                  { id: "providers", label: "Providers", icon: Users },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className={cn(
                        "group relative flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all duration-300",
                        "data-[state=active]:bg-white data-[state=active]:text-sky-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-zinc-200/50",
                        "data-[state=inactive]:text-zinc-500 data-[state=inactive]:hover:bg-white/40 data-[state=inactive]:hover:text-zinc-900"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 transition-colors", isActive ? "text-sky-500" : "text-zinc-400 group-hover:text-zinc-600")} />
                      <span className="relative z-10">{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="relative">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="rounded-3xl border border-white/50 bg-white/60 p-1 shadow-xl shadow-sky-900/5 backdrop-blur-xl ring-1 ring-zinc-900/5">
                  <div className="rounded-[20px] bg-white/50 p-6 sm:p-8">
                    <TabsContent value="general" className="mt-0 focus-visible:outline-none">
                      <GeneralSettings />
                    </TabsContent>
                    <TabsContent value="locations" className="mt-0 focus-visible:outline-none">
                      <LocationsSettings />
                    </TabsContent>
                    <TabsContent value="services" className="mt-0 focus-visible:outline-none">
                      <ServicesSettings />
                    </TabsContent>
                    <TabsContent value="providers" className="mt-0 focus-visible:outline-none">
                      <ProvidersSettings />
                    </TabsContent>
                  </div>
                </div>
              </motion.div>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
