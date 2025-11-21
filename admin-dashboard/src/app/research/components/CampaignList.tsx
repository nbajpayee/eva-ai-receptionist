"use client";

import { useState } from "react";
import { MoreVertical, Play, Pause, Eye, Trash2, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";

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

interface CampaignListProps {
  campaigns: Campaign[];
  onUpdate: () => void;
}

export function CampaignList({ campaigns, onUpdate }: CampaignListProps) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (campaignId: string, action: string) => {
    setActionLoading(campaignId);
    try {
      const response = await fetch(`/api/admin/research/campaigns/${campaignId}/${action}`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        onUpdate();
      } else {
        console.error("Action failed:", data);
      }
    } catch (error) {
      console.error(`Failed to ${action} campaign:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) {
      return;
    }

    setActionLoading(campaignId);
    try {
      const response = await fetch(`/api/admin/research/campaigns/${campaignId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to delete campaign:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      draft: { label: "Draft", variant: "secondary" },
      active: { label: "Active", variant: "default" },
      paused: { label: "Paused", variant: "outline" },
      completed: { label: "Completed", variant: "secondary" },
    };

    const config = variants[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    return type === "research" ? (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        Research
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        Outbound Sales
      </Badge>
    );
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "sms":
        return "💬";
      case "email":
        return "📧";
      case "voice":
        return "📞";
      case "multi":
        return "🔀";
      default:
        return "📱";
    }
  };

  return (
    <div className="grid gap-4">
      {campaigns.map((campaign) => {
        const contactRate =
          campaign.total_targeted > 0 ? (campaign.total_contacted / campaign.total_targeted) * 100 : 0;
        const responseRate =
          campaign.total_contacted > 0 ? (campaign.total_responded / campaign.total_contacted) * 100 : 0;

        return (
          <Card key={campaign.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">{campaign.name}</CardTitle>
                    {getStatusBadge(campaign.status)}
                    {getTypeBadge(campaign.campaign_type)}
                  </div>
                  <CardDescription className="flex items-center gap-4">
                    <span>
                      {getChannelIcon(campaign.channel)} {campaign.channel.toUpperCase()}
                    </span>
                    <span>•</span>
                    <span>Created {new Date(campaign.created_at).toLocaleDateString()}</span>
                    {campaign.launched_at && (
                      <>
                        <span>•</span>
                        <span>Launched {new Date(campaign.launched_at).toLocaleDateString()}</span>
                      </>
                    )}
                  </CardDescription>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={actionLoading === campaign.id}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => router.push(`/research/${campaign.id}`)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>

                    {campaign.status === "draft" && (
                      <DropdownMenuItem onClick={() => handleAction(campaign.id, "launch")}>
                        <Play className="mr-2 h-4 w-4" />
                        Launch Campaign
                      </DropdownMenuItem>
                    )}

                    {campaign.status === "active" && (
                      <>
                        <DropdownMenuItem onClick={() => handleAction(campaign.id, "pause")}>
                          <Pause className="mr-2 h-4 w-4" />
                          Pause Campaign
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction(campaign.id, "complete")}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Complete Campaign
                        </DropdownMenuItem>
                      </>
                    )}

                    {campaign.status === "paused" && (
                      <DropdownMenuItem onClick={() => handleAction(campaign.id, "resume")}>
                        <Play className="mr-2 h-4 w-4" />
                        Resume Campaign
                      </DropdownMenuItem>
                    )}

                    {(campaign.status === "draft" || campaign.status === "completed") && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(campaign.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Campaign
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{campaign.total_targeted}</div>
                  <div className="text-xs text-muted-foreground">Targeted</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{campaign.total_contacted}</div>
                  <div className="text-xs text-muted-foreground">Contacted</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{campaign.total_responded}</div>
                  <div className="text-xs text-muted-foreground">Responded</div>
                </div>
              </div>

              {/* Progress Bars */}
              {campaign.status !== "draft" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Contact Progress</span>
                      <span className="font-medium">{contactRate.toFixed(0)}%</span>
                    </div>
                    <Progress value={contactRate} className="h-2" />
                  </div>

                  {campaign.total_contacted > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Response Rate</span>
                        <span className="font-medium">{responseRate.toFixed(0)}%</span>
                      </div>
                      <Progress value={responseRate} className="h-2" />
                    </div>
                  )}
                </div>
              )}

              {/* View Details Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/research/${campaign.id}`)}
              >
                View Campaign Details
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
