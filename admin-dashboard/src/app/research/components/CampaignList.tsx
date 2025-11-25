"use client";

import { useState } from "react";
import { MoreVertical, Play, Pause, Eye, Trash2, CheckCircle, MessageSquare, Mail, Phone, Share2, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

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
    const variants: Record<string, { label: string; className: string }> = {
      draft: { label: "Draft", className: "bg-zinc-100 text-zinc-700 border-zinc-200" },
      active: { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse-slow" },
      paused: { label: "Paused", className: "bg-amber-50 text-amber-700 border-amber-200" },
      completed: { label: "Completed", className: "bg-blue-50 text-blue-700 border-blue-200" },
    };

    const config = variants[status] || { label: status, className: "bg-zinc-100 text-zinc-700 border-zinc-200" };
    return <Badge variant="outline" className={cn("font-medium", config.className)}>{config.label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    return type === "research" ? (
      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-normal">
        Research
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 font-normal">
        Outbound Sales
      </Badge>
    );
  };

  const getChannelIcon = (channel: string) => {
    const iconClass = "h-3.5 w-3.5 mr-1.5";
    switch (channel) {
      case "sms":
        return <><MessageSquare className={iconClass} /> SMS</>;
      case "email":
        return <><Mail className={iconClass} /> Email</>;
      case "voice":
        return <><Phone className={iconClass} /> Voice</>;
      case "multi":
        return <><Share2 className={iconClass} /> Multi-Channel</>;
      default:
        return <><Smartphone className={iconClass} /> {channel}</>;
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
          <Card 
            key={campaign.id} 
            className="group overflow-hidden border-zinc-200 bg-white/80 backdrop-blur-sm shadow-sm transition-all hover:shadow-md hover:border-sky-200"
          >
            <CardHeader className="bg-zinc-50/30 pb-4">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-lg font-semibold text-zinc-900">{campaign.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(campaign.status)}
                      {getTypeBadge(campaign.campaign_type)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 border border-zinc-200">
                      {getChannelIcon(campaign.channel)}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-zinc-300" />
                    <span>Created {new Date(campaign.created_at).toLocaleDateString()}</span>
                    {campaign.launched_at && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-zinc-300" />
                        <span>Launched {new Date(campaign.launched_at).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-600" disabled={actionLoading === campaign.id}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => router.push(`/research/${campaign.id}`)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>

                    {campaign.status === "draft" && (
                      <DropdownMenuItem onClick={() => handleAction(campaign.id, "launch")}>
                        <Play className="mr-2 h-4 w-4 text-emerald-600" />
                        Launch Campaign
                      </DropdownMenuItem>
                    )}

                    {campaign.status === "active" && (
                      <>
                        <DropdownMenuItem onClick={() => handleAction(campaign.id, "pause")}>
                          <Pause className="mr-2 h-4 w-4 text-amber-600" />
                          Pause Campaign
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction(campaign.id, "complete")}>
                          <CheckCircle className="mr-2 h-4 w-4 text-blue-600" />
                          Complete Campaign
                        </DropdownMenuItem>
                      </>
                    )}

                    {campaign.status === "paused" && (
                      <DropdownMenuItem onClick={() => handleAction(campaign.id, "resume")}>
                        <Play className="mr-2 h-4 w-4 text-emerald-600" />
                        Resume Campaign
                      </DropdownMenuItem>
                    )}

                    {(campaign.status === "draft" || campaign.status === "completed") && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(campaign.id)}
                          className="text-red-600 focus:text-red-700 focus:bg-red-50"
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

            <CardContent className="pt-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-8 text-center pb-6 border-b border-zinc-100">
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-zinc-900">{campaign.total_targeted.toLocaleString()}</div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500 font-medium">Targeted</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-zinc-900">{campaign.total_contacted.toLocaleString()}</div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500 font-medium">Contacted</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-zinc-900">{campaign.total_responded.toLocaleString()}</div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500 font-medium">Responded</div>
                </div>
              </div>

              {/* Progress Bars */}
              {campaign.status !== "draft" && (
                <div className="grid grid-cols-2 gap-6 pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500 font-medium">Contact Progress</span>
                      <span className="font-semibold text-zinc-900">{contactRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={contactRate} className="h-1.5 bg-zinc-100" />
                  </div>

                  {campaign.total_contacted > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500 font-medium">Response Rate</span>
                        <span className="font-semibold text-zinc-900">{responseRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={responseRate} className="h-1.5 bg-zinc-100 [&>div]:bg-emerald-500" />
                    </div>
                  )}
                </div>
              )}

              {/* View Details Button (Mobile only mostly, or as secondary action) */}
              <div className="mt-6 pt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sky-600 hover:text-sky-700 hover:bg-sky-50 -mr-2"
                  onClick={() => router.push(`/research/${campaign.id}`)}
                >
                  Detailed Analytics <CheckCircle className="ml-2 h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
