"use client";

import { useState, useEffect } from "react";
import { ArrowUpRight, Users, TrendingUp, AlertTriangle, Activity } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { SplitStatCard } from "@/components/split-stat-card";
import { CustomerTable, type Customer } from "@/components/customer-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type Analytics = {
  total_customers: number;
  new_this_month: number;
  new_clients_count: number;
  returning_clients_count: number;
  top_customers: Array<{
    id: number;
    name: string;
    phone: string;
    appointment_count: number;
  }>;
  at_risk_customers: Array<{
    id: number;
    name: string;
    phone: string;
    email: string | null;
  }>;
  channel_distribution: Record<string, number>;
  medical_screening: {
    has_allergies: number;
    is_pregnant: number;
  };
};

const defaultAnalytics: Analytics = {
  total_customers: 0,
  new_this_month: 0,
  new_clients_count: 0,
  returning_clients_count: 0,
  top_customers: [],
  at_risk_customers: [],
  channel_distribution: {},
  medical_screening: { has_allergies: 0, is_pregnant: 0 },
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>(defaultAnalytics);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchData();
  }, [page, searchQuery]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch customers
      const customersUrl = new URL("/api/admin/customers", window.location.origin);
      customersUrl.searchParams.set("page", page.toString());
      customersUrl.searchParams.set("page_size", "50");
      if (searchQuery) {
        customersUrl.searchParams.set("search", searchQuery);
      }

      const [customersRes, analyticsRes] = await Promise.all([
        fetch(customersUrl.toString()),
        fetch("/api/admin/customers/analytics"),
      ]);

      if (customersRes.ok) {
        const customersData = await customersRes.json();
        setCustomers(customersData.customers || []);
        setTotalPages(customersData.total_pages || 1);
      }

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1); // Reset to first page on search
  };

  // Calculate channel percentages
  const totalChannelInteractions = Object.values(analytics.channel_distribution).reduce(
    (sum, count) => sum + count,
    0
  );

  const channelPercentages = Object.entries(analytics.channel_distribution).map(
    ([channel, count]) => ({
      channel,
      percentage: totalChannelInteractions > 0 ? (count / totalChannelInteractions) * 100 : 0,
    })
  );

  const numberFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  });

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-900">Customers</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage customer relationships and track engagement across all channels
        </p>
      </div>

      {/* Metrics Row */}
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {/* Total Customers */}
        <StatCard
          title="Total Customers"
          value={analytics.total_customers.toString()}
          description="All-time customer base"
          icon={<Users className="h-5 w-5" />}
          trend={
            <span className="text-xs uppercase tracking-[0.2em] text-emerald-600">
              {analytics.new_this_month} new this month
            </span>
          }
        />

        {/* New This Month */}
        <StatCard
          title="New This Month"
          value={analytics.new_this_month.toString()}
          description="Recent customer acquisitions"
          icon={<ArrowUpRight className="h-5 w-5" />}
        />

        {/* Client Split */}
        <SplitStatCard
          title="Client Distribution"
          leftMetric={{
            label: "New",
            value: analytics.new_clients_count.toString(),
            icon: <Users className="h-4 w-4" />,
          }}
          rightMetric={{
            label: "Returning",
            value: analytics.returning_clients_count.toString(),
            icon: <TrendingUp className="h-4 w-4" />,
          }}
          description="Client type breakdown"
        />

        {/* Medical Screening */}
        <StatCard
          title="Medical Flags"
          value={
            (analytics.medical_screening.has_allergies +
              analytics.medical_screening.is_pregnant).toString()
          }
          description={`${analytics.medical_screening.has_allergies} allergies, ${analytics.medical_screening.is_pregnant} pregnant`}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </section>

      {/* Insights Row */}
      <section className="grid gap-6 md:grid-cols-3">
        {/* Top Customers */}
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle className="text-lg">Top Customers</CardTitle>
            <p className="text-sm text-zinc-500">Most appointments booked</p>
          </CardHeader>
          <CardContent>
            {analytics.top_customers.length === 0 ? (
              <p className="text-center text-sm text-zinc-500 py-4">No data yet</p>
            ) : (
              <div className="space-y-3">
                {analytics.top_customers.slice(0, 5).map((customer, index) => (
                  <Link
                    key={customer.id}
                    href={`/customers/${customer.id}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 transition-colors hover:bg-zinc-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-medium text-sky-700">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900">{customer.name}</p>
                        <p className="text-xs text-zinc-500">{customer.phone}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      {customer.appointment_count} appts
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* At-Risk Customers */}
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle className="text-lg">At-Risk Customers</CardTitle>
            <p className="text-sm text-zinc-500">No activity in 90+ days</p>
          </CardHeader>
          <CardContent>
            {analytics.at_risk_customers.length === 0 ? (
              <p className="text-center text-sm text-zinc-500 py-4">No at-risk customers</p>
            ) : (
              <div className="space-y-3">
                {analytics.at_risk_customers.slice(0, 5).map((customer) => (
                  <Link
                    key={customer.id}
                    href={`/customers/${customer.id}`}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 transition-colors hover:bg-amber-100"
                  >
                    <div>
                      <p className="font-medium text-zinc-900">{customer.name}</p>
                      <p className="text-xs text-zinc-600">{customer.phone}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-amber-700" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Channel Distribution */}
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle className="text-lg">Channel Preferences</CardTitle>
            <p className="text-sm text-zinc-500">How customers engage</p>
          </CardHeader>
          <CardContent>
            {channelPercentages.length === 0 ? (
              <p className="text-center text-sm text-zinc-500 py-4">No data yet</p>
            ) : (
              <div className="space-y-4">
                {channelPercentages.map(({ channel, percentage }) => (
                  <div key={channel} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize text-zinc-900">
                        {channel}
                      </span>
                      <span className="text-zinc-600">
                        {numberFormatter.format(percentage)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full rounded-full ${
                          channel === "voice"
                            ? "bg-sky-500"
                            : channel === "sms"
                            ? "bg-emerald-500"
                            : "bg-violet-500"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Customer Table */}
      <section>
        <CustomerTable
          customers={customers}
          onSearch={handleSearch}
          searchQuery={searchQuery}
          loading={loading}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-zinc-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
