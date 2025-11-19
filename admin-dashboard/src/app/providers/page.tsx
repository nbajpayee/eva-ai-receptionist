"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, Users, Target, Award } from "lucide-react";
import Link from "next/link";

type ProviderSummary = {
  provider_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  specialties: string[];
  total_consultations: number;
  successful_bookings: number;
  conversion_rate: number;
  total_revenue: number;
  avg_satisfaction_score: number | null;
};

type ProviderSummaryResponse = {
  providers: ProviderSummary[];
  period_days: number;
};

export default function ProvidersPage() {
  const [data, setData] = useState<ProviderSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(30);
  const [sortBy, setSortBy] = useState<"conversion_rate" | "revenue" | "consultations">("conversion_rate");

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/providers/summary?days=${periodDays}`);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("Failed to fetch providers:", error);
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  const sortedProviders = data?.providers ? [...data.providers].sort((a, b) => {
    if (sortBy === "conversion_rate") {
      return b.conversion_rate - a.conversion_rate;
    } else if (sortBy === "revenue") {
      return b.total_revenue - a.total_revenue;
    } else {
      return b.total_consultations - a.total_consultations;
    }
  }) : [];

  const topPerformer = sortedProviders[0];
  const avgConversionRate = sortedProviders.length > 0
    ? sortedProviders.reduce((sum, p) => sum + p.conversion_rate, 0) / sortedProviders.length
    : 0;

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

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Provider Performance</h1>
          <p className="text-muted-foreground mt-2">
            Track and compare provider metrics across the team
          </p>
        </div>

        <Select
          value={periodDays.toString()}
          onValueChange={(value: string) => {
            setPeriodDays(parseInt(value, 10));
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Time period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Providers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sortedProviders.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgConversionRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{topPerformer?.name || "N/A"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {topPerformer?.conversion_rate.toFixed(1)}% conversion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${sortedProviders.reduce((sum, p) => sum + p.total_revenue, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sort Controls */}
      <div className="mb-4 flex gap-2">
        <Button
          variant={sortBy === "conversion_rate" ? "default" : "outline"}
          size="sm"
          onClick={() => setSortBy("conversion_rate")}
        >
          Sort by Conversion Rate
        </Button>
        <Button
          variant={sortBy === "revenue" ? "default" : "outline"}
          size="sm"
          onClick={() => setSortBy("revenue")}
        >
          Sort by Revenue
        </Button>
        <Button
          variant={sortBy === "consultations" ? "default" : "outline"}
          size="sm"
          onClick={() => setSortBy("consultations")}
        >
          Sort by Consultations
        </Button>
      </div>

      {/* Provider Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedProviders.map((provider, index) => {
          const isTopPerformer = index === 0;
          const aboveAverage = provider.conversion_rate >= avgConversionRate;

          return (
            <Link href={`/providers/${provider.provider_id}`} key={provider.provider_id}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                        {provider.name.charAt(0)}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {provider.specialties.slice(0, 2).join(", ") || "General"}
                        </CardDescription>
                      </div>
                    </div>
                    {isTopPerformer && (
                      <Badge className="bg-yellow-500 hover:bg-yellow-600">
                        <Award className="h-3 w-3 mr-1" />
                        Top
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Conversion Rate */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Conversion Rate</span>
                      <div className="flex items-center gap-1">
                        {aboveAverage ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className="text-lg font-bold">
                          {provider.conversion_rate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={provider.conversion_rate}
                      className="h-2"
                    />
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Consultations</p>
                      <p className="text-xl font-bold">{provider.total_consultations}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Bookings</p>
                      <p className="text-xl font-bold text-green-600">
                        {provider.successful_bookings}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                      <p className="text-lg font-semibold">
                        ${provider.total_revenue.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Satisfaction</p>
                      <p className="text-lg font-semibold">
                        {provider.avg_satisfaction_score?.toFixed(1) || "N/A"}/10
                      </p>
                    </div>
                  </div>

                  {/* Performance Badge */}
                  <div className="pt-2">
                    {aboveAverage ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Above Average
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        Coaching Opportunity
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {sortedProviders.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No provider data available</p>
            <p className="text-sm text-muted-foreground mt-1">
              Record some consultations to see provider analytics
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
