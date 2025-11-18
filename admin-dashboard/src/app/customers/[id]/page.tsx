"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  Clock,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerTimeline, type TimelineItem } from "@/components/customer-timeline";
import { EditCustomerDialog } from "@/components/edit-customer-dialog";
import { BookAppointmentDialog } from "@/components/book-appointment-dialog";
import { formatDistanceToNow, format } from "date-fns";

type CustomerData = {
  customer: {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    is_new_client: boolean;
    has_allergies: boolean;
    is_pregnant: boolean;
    notes: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  stats: {
    total_appointments: number;
    total_conversations: number;
    avg_satisfaction_score: number | null;
    last_activity_at: string | null;
    preferred_channel: string;
  };
};

type CustomerStats = {
  appointment_stats: {
    total: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    no_show: number;
    rescheduled: number;
  };
  favorite_services: Array<{
    service: string;
    count: number;
  }>;
  communication_stats: {
    total_conversations: number;
    by_channel: Record<string, number>;
    avg_satisfaction_by_channel: Record<string, number>;
    outcomes: Record<string, number>;
  };
};

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineHasMore, setTimelineHasMore] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bookAppointmentDialogOpen, setBookAppointmentDialogOpen] = useState(false);

  useEffect(() => {
    fetchCustomerData();
    fetchStats();
  }, [customerId]);

  useEffect(() => {
    if (activeTab === "timeline") {
      fetchTimeline(1);
    }
  }, [activeTab]);

  const fetchCustomerData = async () => {
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`);
      if (response.ok) {
        const data = await response.json();
        setCustomer(data);
      } else if (response.status === 404) {
        router.push("/customers");
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchTimeline = async (page: number) => {
    try {
      const response = await fetch(
        `/api/admin/customers/${customerId}/timeline?page=${page}&page_size=20`
      );
      if (response.ok) {
        const data = await response.json();
        if (page === 1) {
          setTimeline(data.timeline);
        } else {
          setTimeline((prev) => [...prev, ...data.timeline]);
        }
        setTimelinePage(page);
        setTimelineHasMore(page < data.total_pages);
      }
    } catch (error) {
      console.error("Error fetching timeline:", error);
    }
  };

  const handleLoadMore = () => {
    fetchTimeline(timelinePage + 1);
  };

  if (loading || !customer) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-zinc-500">Loading customer...</p>
      </div>
    );
  }

  const numberFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  });

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/customers">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Customers
        </Link>
      </Button>

      {/* Customer Header Card */}
      <Card className="border-zinc-200">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            {/* Customer Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-zinc-900">
                  {customer.customer.name}
                </h1>
                {customer.customer.is_new_client && (
                  <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
                    New Client
                  </Badge>
                )}
                {(customer.customer.has_allergies || customer.customer.is_pregnant) && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Medical Flags
                  </Badge>
                )}
              </div>

              <div className="flex flex-col gap-2 text-zinc-600">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{customer.customer.phone}</span>
                </div>
                {customer.customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{customer.customer.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Customer since{" "}
                    {customer.customer.created_at
                      ? format(new Date(customer.customer.created_at), "MMM d, yyyy")
                      : "Unknown"}
                  </span>
                </div>
              </div>

              {customer.customer.notes && (
                <div className="rounded-lg bg-zinc-50 p-3 text-sm">
                  <p className="font-medium text-zinc-900">Notes:</p>
                  <p className="text-zinc-700">{customer.customer.notes}</p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-2">
              <Button
                variant="default"
                onClick={() => setBookAppointmentDialogOpen(true)}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Book Appointment
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(true)}
              >
                Edit Profile
              </Button>
              <Button variant="outline" disabled>
                Send Message
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Row */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-zinc-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">Total Appointments</p>
                <p className="text-2xl font-bold text-zinc-900">
                  {customer.stats.total_appointments}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-sky-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">Conversations</p>
                <p className="text-2xl font-bold text-zinc-900">
                  {customer.stats.total_conversations}
                </p>
              </div>
              <MessageSquare className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">Satisfaction</p>
                <p className="text-2xl font-bold text-zinc-900">
                  {customer.stats.avg_satisfaction_score
                    ? `${customer.stats.avg_satisfaction_score}/10`
                    : "N/A"}
                </p>
              </div>
              <Star className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">Last Activity</p>
                <p className="text-sm font-medium text-zinc-900">
                  {customer.stats.last_activity_at
                    ? formatDistanceToNow(new Date(customer.stats.last_activity_at), {
                        addSuffix: true,
                      })
                    : "Never"}
                </p>
              </div>
              <Clock className="h-8 w-8 text-violet-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Activity Summary */}
            <Card className="border-zinc-200">
              <CardHeader>
                <CardTitle>Activity Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">Preferred Channel</span>
                  <Badge variant="outline" className="capitalize">
                    {customer.stats.preferred_channel}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">Total Interactions</span>
                  <span className="font-medium">
                    {customer.stats.total_conversations + customer.stats.total_appointments}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">Average Satisfaction</span>
                  <span
                    className={`font-medium ${
                      customer.stats.avg_satisfaction_score
                        ? customer.stats.avg_satisfaction_score >= 8
                          ? "text-emerald-600"
                          : customer.stats.avg_satisfaction_score >= 5
                          ? "text-amber-600"
                          : "text-rose-600"
                        : "text-zinc-400"
                    }`}
                  >
                    {customer.stats.avg_satisfaction_score
                      ? `${customer.stats.avg_satisfaction_score}/10`
                      : "N/A"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Appointment Insights */}
            {stats && (
              <Card className="border-zinc-200">
                <CardHeader>
                  <CardTitle>Appointment Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Completed</span>
                    <span className="font-medium text-emerald-600">
                      {stats.appointment_stats.completed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Scheduled</span>
                    <span className="font-medium text-sky-600">
                      {stats.appointment_stats.scheduled}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Cancelled</span>
                    <span className="font-medium text-rose-600">
                      {stats.appointment_stats.cancelled}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">No Shows</span>
                    <span className="font-medium text-amber-600">
                      {stats.appointment_stats.no_show}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Favorite Services */}
          {stats && stats.favorite_services.length > 0 && (
            <Card className="border-zinc-200">
              <CardHeader>
                <CardTitle>Favorite Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.favorite_services.map((service, index) => (
                    <div
                      key={service.service}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-medium text-sky-700">
                          {index + 1}
                        </div>
                        <span className="font-medium">{service.service}</span>
                      </div>
                      <Badge variant="outline">{service.count} bookings</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Medical Flags */}
          {(customer.customer.has_allergies || customer.customer.is_pregnant) && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <AlertTriangle className="h-5 w-5" />
                  Medical Flags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-amber-900">
                {customer.customer.has_allergies && (
                  <p>• Patient has reported allergies</p>
                )}
                {customer.customer.is_pregnant && <p>• Patient is pregnant</p>}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <CustomerTimeline
            items={timeline}
            loading={loading}
            onLoadMore={handleLoadMore}
            hasMore={timelineHasMore}
          />
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments">
          <Card className="border-zinc-200">
            <CardHeader>
              <CardTitle>Appointment History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-500">
                Detailed appointment view coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-zinc-200">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-zinc-500">Name</label>
                  <p className="text-zinc-900">{customer.customer.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-500">Phone</label>
                  <p className="text-zinc-900">{customer.customer.phone}</p>
                </div>
                {customer.customer.email && (
                  <div>
                    <label className="text-sm font-medium text-zinc-500">Email</label>
                    <p className="text-zinc-900">{customer.customer.email}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-zinc-500">
                    Client Type
                  </label>
                  <p className="text-zinc-900">
                    {customer.customer.is_new_client ? "New Client" : "Returning Client"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-200">
              <CardHeader>
                <CardTitle>Medical Screening</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600">Has Allergies</span>
                  <Badge
                    variant="outline"
                    className={
                      customer.customer.has_allergies
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-zinc-50 text-zinc-600"
                    }
                  >
                    {customer.customer.has_allergies ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600">Is Pregnant</span>
                  <Badge
                    variant="outline"
                    className={
                      customer.customer.is_pregnant
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-zinc-50 text-zinc-600"
                    }
                  >
                    {customer.customer.is_pregnant ? "Yes" : "No"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-200 md:col-span-2">
              <CardHeader>
                <CardTitle>Account Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Created</span>
                  <span className="text-zinc-900">
                    {customer.customer.created_at
                      ? format(new Date(customer.customer.created_at), "PPpp")
                      : "Unknown"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600">Last Updated</span>
                  <span className="text-zinc-900">
                    {customer.customer.updated_at
                      ? format(new Date(customer.customer.updated_at), "PPpp")
                      : "Unknown"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Customer Dialog */}
      {customer && (
        <EditCustomerDialog
          customer={customer.customer}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => {
            fetchCustomerData();
            fetchStats();
          }}
        />
      )}

      {/* Book Appointment Dialog */}
      {customer && (
        <BookAppointmentDialog
          customerId={customer.customer.id}
          customerName={customer.customer.name}
          open={bookAppointmentDialogOpen}
          onOpenChange={setBookAppointmentDialogOpen}
          onSuccess={() => {
            fetchCustomerData();
            fetchStats();
            if (activeTab === "timeline") {
              fetchTimeline(1);
            }
          }}
        />
      )}
    </div>
  );
}
