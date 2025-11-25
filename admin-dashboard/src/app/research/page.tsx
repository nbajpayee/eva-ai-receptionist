"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Users, TrendingUp, MessageSquare, Phone, Search } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { EnhancedStatCard } from "@/components/dashboard/enhanced-stat-card";

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

// Mock sparkline data for visual consistency
const SPARKLINE_1 = Array.from({ length: 12 }, () => ({ value: Math.floor(Math.random() * 100) }));
const SPARKLINE_2 = Array.from({ length: 12 }, () => ({ value: Math.floor(Math.random() * 80) }));
const SPARKLINE_3 = Array.from({ length: 12 }, () => ({ value: Math.floor(Math.random() * 60) }));
const SPARKLINE_4 = Array.from({ length: 12 }, () => ({ value: Math.floor(Math.random() * 40) + 40 }));

export default function ResearchPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filter campaigns by search
  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  return (
    <div className="min-h-screen space-y-8 pb-8 font-sans">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute left-0 top-0 h-[500px] w-[500px] -translate-x-[30%] -translate-y-[20%] rounded-full bg-sky-200/20 blur-[100px]" />
        <div className="absolute right-0 bottom-0 h-[500px] w-[500px] translate-x-[20%] translate-y-[20%] rounded-full bg-teal-200/20 blur-[100px]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Header */}
        <motion.header variants={itemVariants} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Research & Outbound</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Create targeted campaigns to gather insights or reach out to customers
            </p>
          </div>
          <Button 
            onClick={() => setCreateDialogOpen(true)} 
            className="bg-gradient-to-r from-sky-500 to-teal-500 text-white hover:from-sky-600 hover:to-teal-600 shadow-lg shadow-sky-500/20 border-0"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </motion.header>

        {/* Overview Stats */}
        <motion.div variants={itemVariants} className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <EnhancedStatCard
            title="Active Campaigns"
            value={activeCampaigns}
            icon={<TrendingUp className="h-5 w-5 text-sky-600" />}
            trend={{ value: 12, label: "this month", direction: "up" }}
            sparklineData={SPARKLINE_1}
            color="primary"
            description="Running now"
          />
          <EnhancedStatCard
            title="Total Contacted"
            value={totalContacted}
            icon={<Phone className="h-5 w-5 text-indigo-600" />}
            trend={{ value: 8, label: "vs last week", direction: "up" }}
            sparklineData={SPARKLINE_2}
            color="info"
            description="Across all campaigns"
          />
          <EnhancedStatCard
            title="Total Responses"
            value={totalResponded}
            icon={<MessageSquare className="h-5 w-5 text-emerald-600" />}
            trend={{ value: 24, label: "response rate", direction: "neutral" }} // Using mock trend for visual
            sparklineData={SPARKLINE_3}
            color="success"
            description="Engaged customers"
          />
          <EnhancedStatCard
            title="Avg Response Rate"
            value={`${responseRate}%`}
            icon={<Users className="h-5 w-5 text-amber-600" />}
            trend={{ value: 5, label: "vs average", direction: "up" }}
            sparklineData={SPARKLINE_4}
            color="warning"
            description="Engagement quality"
          />
        </motion.div>

        {/* Campaigns List */}
        <motion.div variants={itemVariants}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <TabsList className="bg-white/50 backdrop-blur-sm border border-zinc-200 p-1 w-fit">
                <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">All Campaigns</TabsTrigger>
                <TabsTrigger value="active" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Active</TabsTrigger>
                <TabsTrigger value="draft" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Drafts</TabsTrigger>
                <TabsTrigger value="completed" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Completed</TabsTrigger>
              </TabsList>
              
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white/80 border-zinc-200 focus:border-sky-500 focus:ring-sky-500/20"
                />
              </div>
            </div>

            <TabsContent value={activeTab} className="space-y-4 mt-0">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-32 w-full animate-pulse rounded-xl bg-white/50 border border-zinc-100" />
                  ))}
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <Card className="border-dashed border-zinc-300 bg-zinc-50/50 shadow-none">
                  <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="rounded-full bg-zinc-100 p-4">
                      <Users className="h-8 w-8 text-zinc-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-medium text-zinc-900">No campaigns found</p>
                      <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
                        {searchQuery ? "Try adjusting your search terms." : "Create your first campaign to start reaching out to customers."}
                      </p>
                    </div>
                    {!searchQuery && (
                      <Button onClick={() => setCreateDialogOpen(true)} variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Campaign
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <CampaignList campaigns={filteredCampaigns} onUpdate={handleCampaignUpdated} />
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCampaignCreated}
      />
    </div>
  );
}
