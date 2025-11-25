"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Share2, Filter, BarChart3 } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { PeriodSelector } from "@/components/period-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartCard } from "@/components/charts/ChartCard";
import { CallVolumeChart } from "@/components/charts/call-volume-chart";
import { SatisfactionTrendChart } from "@/components/charts/satisfaction-trend-chart";
import { FunnelChart } from "@/components/charts/FunnelChart";
import { Heatmap } from "@/components/charts/Heatmap";

import { KPIGrid } from "@/components/analytics/kpi-grid";
import { InsightCards } from "@/components/analytics/insight-cards";
import { ChannelBreakdown } from "@/components/analytics/channel-breakdown";
import { OutcomeBreakdown } from "@/components/analytics/outcome-breakdown";
import { ServicePerformance } from "@/components/analytics/service-performance";

import { 
  DailyMetric, 
  FunnelData, 
  HeatmapPoint, 
  ChannelMetric, 
  OutcomeMetric,
  Period
} from "@/types/analytics-extended";

const DATE_RANGES = [
  { label: "7 Days", value: "7", period: "week" as Period },
  { label: "30 Days", value: "30", period: "month" as Period },
  { label: "90 Days", value: "90", period: "month" as Period }, // Fallback to month for complex charts
] as const;

export default function AnalyticsPage() {
  // State
  const [selectedRange, setSelectedRange] = useState<string>("30");
  const [isLoading, setIsLoading] = useState(true);
  
  // Data State
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
  const [channelData, setChannelData] = useState<ChannelMetric[]>([]);
  const [outcomeData, setOutcomeData] = useState<OutcomeMetric[]>([]);

  // Derived State
  const currentRange = DATE_RANGES.find(r => r.value === selectedRange) || DATE_RANGES[1];
  
  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch Daily Metrics (Source of Truth for Line Charts)
        const dailyRes = await fetch(`/api/admin/analytics/daily?days=${selectedRange}`);
        if (dailyRes.ok) {
          const data = await dailyRes.json();
          setDailyMetrics(data.metrics || []);
        }

        // 2. Fetch specialized data using the mapped 'period'
        // Note: 90 days maps to 'month' for these charts as backend doesn't support 90d for them yet
        const period = currentRange.period;

        const [funnelRes, heatmapRes, channelRes, outcomeRes] = await Promise.all([
          fetch(`/api/admin/analytics/funnel?period=${period}`),
          fetch(`/api/admin/analytics/peak-hours?period=${period}`),
          fetch(`/api/admin/analytics/channel-distribution?period=${period}`),
          fetch(`/api/admin/analytics/outcome-distribution?period=${period}`)
        ]);

        if (funnelRes.ok) setFunnelData(await funnelRes.json());
        if (heatmapRes.ok) setHeatmapData(await heatmapRes.json());
        if (channelRes.ok) setChannelData(await channelRes.json());
        if (outcomeRes.ok) setOutcomeData(await outcomeRes.json());

      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [selectedRange, currentRange.period]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="min-h-screen space-y-8 bg-background p-6 sm:p-8 font-sans">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute left-0 top-0 h-[600px] w-[600px] bg-primary/5 blur-[120px]" />
        <div className="absolute right-0 bottom-0 h-[600px] w-[600px] bg-accent/5 blur-[120px]" />
      </div>

      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Analytics & Trends</h1>
          <p className="text-sm text-zinc-500">
            Deep dive into your reception performance and business growth
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <PeriodSelector
            selectedPeriod={selectedRange}
            onPeriodChange={setSelectedRange}
            periods={DATE_RANGES}
          />

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-10 gap-2 hidden sm:flex">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" size="sm" className="h-10 gap-2 hidden sm:flex">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </motion.header>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* 1. Executive Summary */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Executive Summary</h2>
            <span className="text-xs text-muted-foreground">Updated {format(new Date(), "h:mm a")}</span>
          </div>
          <KPIGrid metrics={dailyMetrics} period={currentRange.period} loading={isLoading} />
        </section>

        {/* 2. AI Insights */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BarChart3 className="h-3 w-3" />
            </span>
            AI Insights
          </h2>
          <InsightCards />
        </section>

        {/* 3. Volume & Engagement */}
        <section className="grid gap-6 lg:grid-cols-3">
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <ChartCard
              title="Call Volume & Bookings"
              description="Compare total incoming calls against successful bookings"
              isLoading={isLoading}
              className="h-full shadow-sm border-border bg-card/50 backdrop-blur-sm"
            >
              <CallVolumeChart data={dailyMetrics} />
            </ChartCard>
          </motion.div>

          <motion.div variants={itemVariants} className="lg:col-span-1">
            <ChartCard
              title="Channel Breakdown"
              description="Distribution of incoming communications"
              isLoading={isLoading}
              className="h-full shadow-sm border-border bg-card/50 backdrop-blur-sm"
            >
              {channelData.length > 0 ? (
                <ChannelBreakdown data={channelData} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No channel data available
                </div>
              )}
            </ChartCard>
          </motion.div>
        </section>

        {/* 4. Conversion & Outcomes */}
        <section className="grid gap-6 lg:grid-cols-2">
          <motion.div variants={itemVariants}>
            <ChartCard
              title="Conversion Funnel"
              description="Drop-off analysis from inquiry to completion"
              isLoading={isLoading}
              className="h-full shadow-sm border-border bg-card/50 backdrop-blur-sm"
            >
              {funnelData?.stages ? (
                <FunnelChart stages={funnelData.stages} />
              ) : (
                <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                  No funnel data available
                </div>
              )}
            </ChartCard>
          </motion.div>

          <motion.div variants={itemVariants}>
            <ChartCard
              title="Outcome Distribution"
              description="Breakdown of all conversation outcomes"
              isLoading={isLoading}
              className="h-full shadow-sm border-border bg-card/50 backdrop-blur-sm"
            >
              {outcomeData.length > 0 ? (
                <OutcomeBreakdown data={outcomeData} />
              ) : (
                <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                  No outcome data available
                </div>
              )}
            </ChartCard>
          </motion.div>
        </section>

        {/* 5. Quality & Performance */}
        <section className="grid gap-6 lg:grid-cols-3">
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <SatisfactionTrendChart data={dailyMetrics} />
          </motion.div>

          <motion.div variants={itemVariants} className="lg:col-span-1">
             <ChartCard
              title="Performance by Service"
              description="Top converting service categories"
              isLoading={false} // Mock data is always ready
              className="h-full shadow-sm border-border bg-card/50 backdrop-blur-sm"
            >
              <ServicePerformance />
            </ChartCard>
          </motion.div>
        </section>

        {/* 6. Time Analysis */}
        <motion.section variants={itemVariants}>
          <ChartCard
            title="Peak Traffic Heatmap"
            description="Identify high-volume hours to optimize staffing"
            isLoading={isLoading}
            className="shadow-sm border-border bg-card/50 backdrop-blur-sm"
          >
            {heatmapData.length > 0 ? (
              <Heatmap data={heatmapData} />
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No heatmap data available
              </div>
            )}
          </ChartCard>
        </motion.section>
      </motion.div>
    </div>
  );
}
