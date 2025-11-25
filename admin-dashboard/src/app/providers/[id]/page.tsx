"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  Target,
  Clock,
  Smile,
  CheckCircle,
  Lightbulb,
  ThumbsUp,
  ArrowLeft,
  Calendar
} from "lucide-react";
import Link from "next/link";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type Provider = {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialties: string[];
  hire_date: string | null;
  bio: string | null;
};

type ProviderMetrics = {
  summary: {
    provider_id: string;
    name: string;
    total_consultations: number;
    successful_bookings: number;
    conversion_rate: number;
    total_revenue: number;
    avg_satisfaction_score: number | null;
  };
  trends: {
    conversion_rate: Array<{ date: string; value: number }>;
    revenue: Array<{ date: string; value: number }>;
  };
  outcomes: Record<string, number>;
  service_performance: Array<{
    service_type: string;
    total_consultations: number;
    successful_bookings: number;
    conversion_rate: number;
  }>;
  period_days: number;
};

type AIInsight = {
  id: string;
  type: string;
  title: string;
  insight_text: string;
  supporting_quote: string | null;
  recommendation: string | null;
  confidence_score: number;
  is_positive: boolean;
  is_reviewed: boolean;
  created_at: string;
};

type Consultation = {
  id: string;
  customer_id: number | null;
  service_type: string;
  outcome: string;
  duration_seconds: number;
  satisfaction_score: number | null;
  sentiment: string | null;
  ai_summary: string | null;
  created_at: string;
  ended_at: string | null;
};

const COLORS = {
  booked: "#10B981", // Emerald 500
  declined: "#EF4444", // Red 500
  thinking: "#F59E0B", // Amber 500
  follow_up_needed: "#0EA5E9" // Sky 500 (Primary 1)
};

export default function ProviderDetailPage() {
  const params = useParams();
  const providerId = params.id as string;

  const [provider, setProvider] = useState<Provider | null>(null);
  const [metrics, setMetrics] = useState<ProviderMetrics | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const periodDays = 30;

  const fetchProviderData = useCallback(async () => {
    if (!providerId) {
      return;
    }

    setLoading(true);
    try {
      const [providerRes, metricsRes, insightsRes, consultationsRes] = await Promise.all([
        fetch(`/api/providers/${providerId}`),
        fetch(`/api/providers/${providerId}/metrics?days=${periodDays}`),
        fetch(`/api/providers/${providerId}/insights`),
        fetch(`/api/providers/${providerId}/consultations?limit=20`)
      ]);

      const [providerData, metricsData, insightsData, consultationsData] = await Promise.all([
        providerRes.json(),
        metricsRes.json(),
        insightsRes.json(),
        consultationsRes.json()
      ]);

      setProvider(providerData);
      setMetrics(metricsData);
      setInsights(insightsData.insights || []);
      setConsultations(consultationsData.consultations || []);
    } catch (error) {
      console.error("Failed to fetch provider data:", error);
    } finally {
      setLoading(false);
    }
  }, [periodDays, providerId]);

  useEffect(() => {
    void fetchProviderData();
  }, [fetchProviderData]);

  const markInsightReviewed = async (insightId: string) => {
    try {
      await fetch(`/api/insights/${insightId}/review`, { method: "PUT" });
      setInsights(prev =>
        prev.map(i => i.id === insightId ? { ...i, is_reviewed: true } : i)
      );
    } catch (error) {
      console.error("Failed to mark insight as reviewed:", error);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!provider || !metrics) {
    return (
      <div className="p-8">
        <p>Provider not found</p>
      </div>
    );
  }

  const strengths = insights.filter(i => i.is_positive);
  const opportunities = insights.filter(i => !i.is_positive);

  // Prepare outcomes chart data
  const outcomesData = Object.entries(metrics.outcomes).map(([key, value]) => ({
    name: key.replace(/_/g, " "),
    value,
    color: COLORS[key as keyof typeof COLORS] || "#gray"
  }));

  type OutcomeDatum = (typeof outcomesData)[number];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/providers">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Providers
          </Button>
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center text-white font-bold text-3xl">
              {provider.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{provider.name}</h1>
              <p className="text-muted-foreground">{provider.email}</p>
              <div className="flex gap-2 mt-2">
                {provider.specialties?.map((specialty) => (
                  <Badge key={specialty} variant="secondary">{specialty}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.summary.conversion_rate.toFixed(1)}%</div>
            <Progress value={metrics.summary.conversion_rate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.summary.total_revenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.summary.successful_bookings} bookings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consultations</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.summary.total_consultations}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last {periodDays} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
            <Smile className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.summary.avg_satisfaction_score?.toFixed(1) || "N/A"}/10
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="consultations">Consultations</TabsTrigger>
        </TabsList>

        {/* AI Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Strengths */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ThumbsUp className="h-5 w-5 text-green-600" />
                  Strengths ({strengths.length})
                </CardTitle>
                <CardDescription>
                  What {provider.name.split(" ")[0]} does exceptionally well
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {strengths.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Record more consultations to generate insights
                  </p>
                )}
                {strengths.map((insight) => (
                  <div
                    key={insight.id}
                    className={`p-4 rounded-lg border ${insight.is_reviewed ? "bg-muted/50" : "bg-teal-50 border-teal-200"}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-sm">{insight.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {(insight.confidence_score * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {insight.insight_text}
                    </p>
                    {insight.supporting_quote && (
                      <div className="bg-white p-2 rounded border-l-2 border-teal-500 mb-2">
                        <p className="text-xs italic">&ldquo;{insight.supporting_quote}&rdquo;</p>
                      </div>
                    )}
                    {!insight.is_reviewed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markInsightReviewed(insight.id)}
                        className="mt-2"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Mark Reviewed
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Opportunities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-orange-600" />
                  Coaching Opportunities ({opportunities.length})
                </CardTitle>
                <CardDescription>
                  Areas for improvement and growth
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {opportunities.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Record more consultations to generate insights
                  </p>
                )}
                {opportunities.map((insight) => (
                  <div
                    key={insight.id}
                    className={`p-4 rounded-lg border ${insight.is_reviewed ? "bg-gray-50" : "bg-orange-50 border-orange-200"}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-sm">{insight.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {(insight.confidence_score * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {insight.insight_text}
                    </p>
                    {insight.supporting_quote && (
                      <div className="bg-white p-2 rounded border-l-2 border-orange-500 mb-2">
                        <p className="text-xs italic">&ldquo;{insight.supporting_quote}&rdquo;</p>
                      </div>
                    )}
                    {insight.recommendation && (
                      <div className="bg-blue-50 p-2 rounded mt-2">
                        <p className="text-xs font-medium text-blue-900">
                          💡 Recommendation: {insight.recommendation}
                        </p>
                      </div>
                    )}
                    {!insight.is_reviewed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markInsightReviewed(insight.id)}
                        className="mt-2"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Mark Reviewed
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Conversion Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Conversion Rate Trend</CardTitle>
                <CardDescription>Daily conversion rate over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={metrics.trends.conversion_rate}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#0EA5E9" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Outcomes Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Consultation Outcomes</CardTitle>
                <CardDescription>Distribution of consultation results</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={outcomesData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: OutcomeDatum) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {outcomesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Service Performance */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Performance by Service</CardTitle>
                <CardDescription>Conversion rates for different service types</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.service_performance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="service_type" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total_consultations" fill="#94a3b8" name="Consultations" />
                    <Bar dataKey="successful_bookings" fill="#14B8A6" name="Bookings" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Consultations Tab */}
        <TabsContent value="consultations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Consultations</CardTitle>
              <CardDescription>Last 20 consultations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {consultations.map((consultation) => (
                  <div
                    key={consultation.id}
                    className="p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={consultation.outcome === "booked" ? "default" : "secondary"}
                            className={cn(
                              consultation.outcome === "declined" && "border-red-200 bg-red-100 text-red-700"
                            )}
                          >
                            {consultation.outcome}
                          </Badge>
                          <span className="text-sm font-medium">
                            {consultation.service_type || "General consultation"}
                          </span>
                        </div>
                        {consultation.ai_summary && (
                          <p className="text-sm text-muted-foreground">
                            {consultation.ai_summary}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {Math.floor(consultation.duration_seconds / 60)} min
                          </span>
                          {consultation.satisfaction_score && (
                            <span className="flex items-center gap-1">
                              <Smile className="h-3 w-3" />
                              {consultation.satisfaction_score.toFixed(1)}/10
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(consultation.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
