"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Play, Pause, CheckCircle, MessageSquare, TrendingUp, Users, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ChannelBreakdownEntry {
  total: number;
  completed: number;
  responded: number;
}

interface CampaignStats {
  campaign_id: string;
  campaign_name: string;
  campaign_type: string;
  status: string;
  total_targeted: number;
  total_contacted: number;
  total_responded: number;
  completion_rate: number;
  response_rate: number;
  avg_satisfaction_score: number | null;
  sentiment_distribution: Record<string, number>;
  outcome_distribution: Record<string, number>;
  channel_breakdown: Record<string, ChannelBreakdownEntry>;
  launched_at: string | null;
  completed_at: string | null;
}

interface Conversation {
  id: string;
  customer_name: string;
  customer_phone: string;
  channel: string;
  status: string;
  initiated_at: string;
  satisfaction_score: number | null;
  sentiment: string | null;
  outcome: string | null;
  ai_summary: string | null;
}

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCampaignStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/research/campaigns/${id}/stats`);

      if (!response.ok) {
        const text = await response.text();
        console.error("Failed to fetch campaign stats:", response.status, text);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch campaign stats:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/research/campaigns/${id}/conversations`);

      if (!response.ok) {
        const text = await response.text();
        console.error("Failed to fetch conversations:", response.status, text);
        return;
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    }
  }, [id]);

  useEffect(() => {
    void fetchCampaignStats();
    void fetchConversations();
  }, [fetchCampaignStats, fetchConversations]);

  const handleAction = async (action: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/research/campaigns/${id}/${action}`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        void fetchCampaignStats();
      }
    } catch (error) {
      console.error(`Failed to ${action} campaign:`, error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading campaign details...</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
      draft: { label: "Draft", variant: "secondary" },
      active: { label: "Active", variant: "default" },
      paused: { label: "Paused", variant: "outline" },
      completed: { label: "Completed", variant: "secondary" },
    };

    const config = variants[status] || { label: status, variant: "outline" as BadgeProps["variant"] };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/research")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{stats.campaign_name}</h1>
              {getStatusBadge(stats.status)}
            </div>
            <p className="text-muted-foreground mt-1">
              {stats.campaign_type === "research" ? "Research Campaign" : "Outbound Sales Campaign"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {stats.status === "draft" && (
            <Button onClick={() => handleAction("launch")} disabled={actionLoading}>
              <Play className="mr-2 h-4 w-4" />
              Launch Campaign
            </Button>
          )}

          {stats.status === "active" && (
            <>
              <Button onClick={() => handleAction("pause")} variant="outline" disabled={actionLoading}>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
              <Button onClick={() => handleAction("complete")} disabled={actionLoading}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete
              </Button>
            </>
          )}

          {stats.status === "paused" && (
            <Button onClick={() => handleAction("resume")} disabled={actionLoading}>
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Targeted</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_targeted}</div>
            <p className="text-xs text-muted-foreground">Customers in segment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contacted</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_contacted}</div>
            <Progress value={(stats.total_contacted / stats.total_targeted) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Responded</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_responded}</div>
            <p className="text-xs text-muted-foreground">{stats.response_rate.toFixed(1)}% response rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Satisfaction</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avg_satisfaction_score ? stats.avg_satisfaction_score.toFixed(1) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">Out of 10</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <Tabs defaultValue="conversations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Conversations</CardTitle>
              <CardDescription>All customer interactions from this campaign</CardDescription>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No conversations yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sentiment</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversations.map((conv) => (
                      <TableRow key={conv.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{conv.customer_name}</div>
                            <div className="text-sm text-muted-foreground">{conv.customer_phone}</div>
                          </div>
                        </TableCell>
                        <TableCell className="uppercase">{conv.channel}</TableCell>
                        <TableCell>
                          <Badge variant={conv.status === "completed" ? "default" : "secondary"}>
                            {conv.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{conv.sentiment || "-"}</TableCell>
                        <TableCell>{conv.outcome || "-"}</TableCell>
                        <TableCell>{new Date(conv.initiated_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(stats.sentiment_distribution).length === 0 ? (
                  <p className="text-muted-foreground">No sentiment data yet</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(stats.sentiment_distribution).map(([sentiment, count]) => (
                      <div key={sentiment} className="flex justify-between items-center">
                        <span className="capitalize">{sentiment}</span>
                        <Badge>{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Outcome Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(stats.outcome_distribution).length === 0 ? (
                  <p className="text-muted-foreground">No outcome data yet</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(stats.outcome_distribution).map(([outcome, count]) => (
                      <div key={outcome} className="flex justify-between items-center">
                        <span className="capitalize">{outcome.replace("_", " ")}</span>
                        <Badge>{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Settings</CardTitle>
              <CardDescription>Configuration and details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-sm font-medium">Type:</span>
                <p className="text-sm text-muted-foreground capitalize">{stats.campaign_type.replace("_", " ")}</p>
              </div>
              {stats.launched_at && (
                <div>
                  <span className="text-sm font-medium">Launched:</span>
                  <p className="text-sm text-muted-foreground">{new Date(stats.launched_at).toLocaleString()}</p>
                </div>
              )}
              {stats.completed_at && (
                <div>
                  <span className="text-sm font-medium">Completed:</span>
                  <p className="text-sm text-muted-foreground">{new Date(stats.completed_at).toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
