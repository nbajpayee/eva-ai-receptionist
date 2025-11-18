"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, MapPin, Clock, Briefcase, Users } from "lucide-react";
import { GeneralSettings } from "@/components/settings/general-settings";
import { LocationsSettings } from "@/components/settings/locations-settings";
import { ServicesSettings } from "@/components/settings/services-settings";
import { ProvidersSettings } from "@/components/settings/providers-settings";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Med Spa Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure your med spa information, locations, services, and providers
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Services
          </TabsTrigger>
          <TabsTrigger value="providers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Providers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettings />
        </TabsContent>

        <TabsContent value="locations">
          <LocationsSettings />
        </TabsContent>

        <TabsContent value="services">
          <ServicesSettings />
        </TabsContent>

        <TabsContent value="providers">
          <ProvidersSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
