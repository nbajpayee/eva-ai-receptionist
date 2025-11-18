"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CampaignStats() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Statistics</CardTitle>
        <CardDescription>Overview of campaign performance</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Select a campaign to view detailed statistics</p>
      </CardContent>
    </Card>
  );
}
