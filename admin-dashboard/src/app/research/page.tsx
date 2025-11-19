"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Users, TrendingUp, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignList } from "./components/CampaignList";
import { CreateCampaignDialog } from "./components/CreateCampaignDialog";

interface Campaign {
  id: string;
  name: string;
  campaign_type: "research" | "outbound_sales";
  status: "draft" | "active" | "paused" | "completed";
  total_targeted: number;
  total_contacted: number;
  total_responded: number;
  channel: string;
  created_at: string;
  launched_at?: string;
  completed_at?: string;
}

export default function ResearchPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilter = activeTab === "all" ? "" : `?status=${activeTab}`;
      const response = await fetch(`/api/admin/research/campaigns${statusFilter}`);
      const data = await response.json();

      if (data.success) {
        setCampaigns(data.campaigns);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleCampaignCreated = () => {
    setCreateDialogOpen(false);
    fetchCampaigns();
  };

  const handleCampaignUpdated = () => {
    fetchCampaigns();
  };

  // Calculate overview stats
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const totalContacted = campaigns.reduce((sum, c) => sum + c.total_contacted, 0);
  const totalResponded = campaigns.reduce((sum, c) => sum + c.total_responded, 0);
  const responseRate = totalContacted > 0 ? ((totalResponded / totalContacted) * 100).toFixed(1) : "0";

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Research & Outbound</h1>
          <p className="text-muted-foreground mt-1">
            Create targeted campaigns to gather insights or reach out to customers
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacted</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalContacted}</div>
            <p className="text-xs text-muted-foreground">Across all campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResponded}</div>
            <p className="text-xs text-muted-foreground">Customers engaged</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{responseRate}%</div>
            <p className="text-xs text-muted-foreground">Average engagement</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Campaigns</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading campaigns...</p>
              </CardContent>
            </Card>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                <Users className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-lg font-medium">No campaigns yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create your first campaign to start reaching out to customers
                  </p>
                </div>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Button>
              </CardContent>
            </Card>
          ) : (
            <CampaignList campaigns={campaigns} onUpdate={handleCampaignUpdated} />
          )}
        </TabsContent>
      </Tabs>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCampaignCreated}
      />
    </div>
  );
}
