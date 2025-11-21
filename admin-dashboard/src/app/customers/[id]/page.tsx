"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit2, Trash2, Save, X, Phone, Mail, AlertTriangle, Baby, Calendar, MessageSquare, Headphones, TrendingUp, DollarSign, Star, Activity, Send, CalendarPlus, Clock, UserX } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  is_new_client: boolean;
  has_allergies: boolean;
  is_pregnant: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  appointment_count?: number;
  call_count?: number;
  conversation_count?: number;
}

interface Appointment {
  id: number;
  appointment_datetime: string;
  service_type: string;
  provider?: string;
  status: string;
  booked_by: string;
  special_requests?: string;
  created_at?: string;
}

interface Call {
  id: number;
  session_id: string;
  started_at?: string;
  duration_seconds?: number;
  satisfaction_score?: number;
  sentiment?: string;
  outcome?: string;
  escalated: boolean;
}

interface Conversation {
  id: string;
  channel: string;
  initiated_at?: string;
  status?: string;
  outcome?: string;
  satisfaction_score?: number;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function getStatusBadgeProps(status?: string | null) {
  const normalized = status?.toLowerCase() ?? "";

  switch (normalized) {
    case "completed":
    case "success":
      return { variant: "default" as const };
    case "cancelled":
    case "canceled":
    case "failed":
      return {
        variant: "outline" as const,
        className: "border-red-200 bg-red-100 text-red-700",
      };
    case "active":
    case "scheduled":
    case "pending":
      return { variant: "secondary" as const };
    default:
      return { variant: "outline" as const };
  }
}

interface CustomerHistory {
  customer: Customer;
  appointments: Appointment[];
  calls: Call[];
  conversations: Conversation[];
}

interface CustomerStats {
  customer_id: number;
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  no_show_rate: number;
  total_calls: number;
  total_conversations: number;
  avg_satisfaction_score: number | null;
  is_new_client: boolean;
  has_allergies: boolean;
  is_pregnant: boolean;
}

type TimelineItem = {
  type: 'appointment' | 'call' | 'conversation';
  date: Date;
  data: Appointment | Call | Conversation;
};

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [data, setData] = useState<CustomerHistory | null>(null);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Create unified timeline from all interactions
  const createTimeline = (): TimelineItem[] => {
    if (!data) return [];

    const timeline: TimelineItem[] = [];

    // Add appointments
    data.appointments.forEach(apt => {
      timeline.push({
        type: 'appointment',
        date: new Date(apt.appointment_datetime),
        data: apt
      });
    });

    // Add calls
    data.calls.forEach(call => {
      if (call.started_at) {
        timeline.push({
          type: 'call',
          date: new Date(call.started_at),
          data: call
        });
      }
    });

    // Add conversations
    data.conversations.forEach(conv => {
      if (conv.initiated_at) {
        timeline.push({
          type: 'conversation',
          date: new Date(conv.initiated_at),
          data: conv
        });
      }
    });

    // Sort by date (most recent first)
    return timeline.sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  const timeline = createTimeline();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch both history and stats in parallel
        const [historyResponse, statsResponse] = await Promise.all([
          fetch(`/api/admin/customers/${resolvedParams.id}/history`),
          fetch(`/api/admin/customers/${resolvedParams.id}/stats`),
        ]);

        if (!historyResponse.ok) {
          throw new Error("Failed to fetch customer history");
        }

        if (!statsResponse.ok) {
          throw new Error("Failed to fetch customer stats");
        }

        const historyData = await historyResponse.json();
        const statsData = await statsResponse.json();

        setData(historyData);
        setStats(statsData);
        setEditForm(historyData.customer);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams.id]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/customers/${resolvedParams.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        throw new Error("Failed to update customer");
      }

      const updatedCustomer = await response.json();
      setData((prev) => prev ? { ...prev, customer: updatedCustomer } : null);
      setIsEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this customer? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/customers/${resolvedParams.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details?.detail || "Failed to delete customer");
      }

      router.push("/customers");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-red-600">Error: {error || "Customer not found"}</p>
        <Link href="/customers">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Customers
          </Button>
        </Link>
      </div>
    );
  }

  const customer = data.customer;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/customers">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">
              {customer.name}
              {customer.is_new_client && (
                <Badge variant="secondary" className="ml-2">
                  New Client
                </Badge>
              )}
            </h1>
            <p className="text-sm text-zinc-500">Customer ID: {customer.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
          {isEditing && (
            <>
              <Button variant="outline" onClick={() => {
                setIsEditing(false);
                setEditForm(customer);
              }}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks for this customer</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Link href={`/messaging?customer_id=${customer.id}`}>
            <Button variant="default">
              <Send className="mr-2 h-4 w-4" />
              Send Message
            </Button>
          </Link>
          <Link href={`/appointments?customer_id=${customer.id}&action=new`}>
            <Button variant="outline">
              <CalendarPlus className="mr-2 h-4 w-4" />
              Book Appointment
            </Button>
          </Link>
          {customer.phone && (
            <a href={`tel:${customer.phone}`}>
              <Button variant="outline">
                <Phone className="mr-2 h-4 w-4" />
                Call
              </Button>
            </a>
          )}
          {customer.email && (
            <a href={`mailto:${customer.email}`}>
              <Button variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                Email
              </Button>
            </a>
          )}
        </CardContent>
      </Card>

      {/* Customer Statistics */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-zinc-200 rounded animate-pulse" />
                <div className="h-4 w-4 bg-zinc-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-zinc-200 rounded animate-pulse mb-2" />
                <div className="h-3 w-32 bg-zinc-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {/* Lifetime Value - Calculated from completed appointments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lifetime Value</CardTitle>
              <DollarSign className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(stats.completed_appointments * 350).toLocaleString()}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Estimated from {stats.completed_appointments} completed appointments
              </p>
            </CardContent>
          </Card>

          {/* Total Appointments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Appointments</CardTitle>
              <Calendar className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_appointments}</div>
              <p className="text-xs text-zinc-500 mt-1">
                {stats.completed_appointments} completed • {stats.cancelled_appointments} cancelled
              </p>
            </CardContent>
          </Card>

          {/* Satisfaction Score */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
              <Star className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.avg_satisfaction_score !== null
                  ? `${stats.avg_satisfaction_score.toFixed(1)}/10`
                  : "N/A"}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                From {stats.total_calls} voice calls
              </p>
            </CardContent>
          </Card>

          {/* Total Interactions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
              <Activity className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.total_calls + stats.total_conversations}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {stats.total_calls} calls • {stats.total_conversations} messages
              </p>
            </CardContent>
          </Card>

          {/* No Show Rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">No Show Rate</CardTitle>
              <UserX className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.no_show_rate.toFixed(1)}%
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {stats.cancelled_appointments} of {stats.total_appointments} appointments
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Customer Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditing ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-zinc-500">Phone</label>
                  <p className="flex items-center gap-2 text-zinc-900">
                    <Phone className="h-4 w-4" />
                    {customer.phone}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-500">Email</label>
                  <p className="flex items-center gap-2 text-zinc-900">
                    <Mail className="h-4 w-4" />
                    {customer.email || "Not provided"}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-500">Medical Screening</label>
                <div className="flex items-center gap-2 mt-1">
                  {customer.has_allergies && (
                    <Badge
                      variant="outline"
                      className="border-red-200 bg-red-100 text-red-700"
                    >
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Has Allergies
                    </Badge>
                  )}
                  {customer.is_pregnant && (
                    <Badge className="bg-pink-600">
                      <Baby className="mr-1 h-3 w-3" />
                      Pregnant
                    </Badge>
                  )}
                  {!customer.has_allergies && !customer.is_pregnant && (
                    <span className="text-sm text-zinc-500">No flags</span>
                  )}
                </div>
              </div>

              {customer.notes && (
                <div>
                  <label className="text-sm font-medium text-zinc-500">Notes</label>
                  <p className="text-zinc-900 whitespace-pre-wrap">{customer.notes}</p>
                </div>
              )}

              <div className="text-xs text-zinc-500 pt-2 border-t">
                Added {customer.created_at ? format(new Date(customer.created_at), "PPP") : "Unknown"}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <input
                    type="text"
                    value={editForm.name || ""}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone || ""}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={editForm.email || ""}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-md"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.has_allergies || false}
                    onChange={(e) => setEditForm({ ...editForm, has_allergies: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Has allergies</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.is_pregnant || false}
                    onChange={(e) => setEditForm({ ...editForm, is_pregnant: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Is pregnant</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.is_new_client !== undefined ? !editForm.is_new_client : false}
                    onChange={(e) => setEditForm({ ...editForm, is_new_client: !e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Mark as existing client</span>
                </label>
              </div>

              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  value={editForm.notes || ""}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-md"
                  placeholder="Add any notes about this customer..."
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Tabs */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList>
          <TabsTrigger value="timeline">
            <Clock className="mr-2 h-4 w-4" />
            Timeline ({timeline.length})
          </TabsTrigger>
          <TabsTrigger value="appointments">
            <Calendar className="mr-2 h-4 w-4" />
            Appointments ({data.appointments.length})
          </TabsTrigger>
          <TabsTrigger value="calls">
            <Headphones className="mr-2 h-4 w-4" />
            Calls ({data.calls.length})
          </TabsTrigger>
          <TabsTrigger value="messages">
            <MessageSquare className="mr-2 h-4 w-4" />
            Messages ({data.conversations.length})
          </TabsTrigger>
        </TabsList>

        {/* Unified Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          {timeline.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-zinc-500">
                No activity yet
              </CardContent>
            </Card>
          ) : (
            timeline.map((item, index) => {
              if (item.type === 'appointment') {
                const apt = item.data as Appointment;
                const badgeProps = getStatusBadgeProps(apt.status);
                return (
                  <Card key={`apt-${apt.id}-${index}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 p-2 bg-blue-100 rounded-full">
                            <Calendar className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Appointment: {apt.service_type}</CardTitle>
                            <CardDescription>
                              {format(new Date(apt.appointment_datetime), "PPP 'at' p")}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant={badgeProps.variant} className={badgeProps.className}>
                          {apt.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm pl-[60px]">
                      {apt.provider && <p className="text-zinc-500">Provider: {apt.provider}</p>}
                      {apt.special_requests && <p className="mt-2 text-zinc-700">{apt.special_requests}</p>}
                      <p className="text-xs text-zinc-400 mt-2">Booked by {apt.booked_by}</p>
                    </CardContent>
                  </Card>
                );
              } else if (item.type === 'call') {
                const call = item.data as Call;
                const badgeProps = getStatusBadgeProps(call.outcome);
                return (
                  <Card key={`call-${call.id}-${index}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 p-2 bg-green-100 rounded-full">
                            <Headphones className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Voice Call</CardTitle>
                            <CardDescription>
                              {call.started_at ? format(new Date(call.started_at), "PPP 'at' p") : "Unknown"}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {call.outcome && (
                            <Badge variant={badgeProps.variant} className={badgeProps.className}>
                              {call.outcome}
                            </Badge>
                          )}
                          {call.escalated && (
                            <Badge variant="outline" className="border-red-200 bg-red-100 text-red-700">
                              Escalated
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1 pl-[60px]">
                      {call.duration_seconds && (
                        <p className="text-zinc-500">Duration: {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s</p>
                      )}
                      {call.satisfaction_score !== undefined && call.satisfaction_score !== null && (
                        <p className="text-zinc-500">Satisfaction: {call.satisfaction_score}/10</p>
                      )}
                      {call.sentiment && (
                        <p className="text-zinc-500">Sentiment: {call.sentiment}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              } else if (item.type === 'conversation') {
                const conv = item.data as Conversation;
                const statusBadgeProps = getStatusBadgeProps(conv.status);
                const outcomeBadgeProps = getStatusBadgeProps(conv.outcome);
                return (
                  <Card key={`conv-${conv.id}-${index}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 p-2 bg-purple-100 rounded-full">
                            <MessageSquare className="h-4 w-4 text-purple-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg capitalize">{conv.channel} Conversation</CardTitle>
                            <CardDescription>
                              {conv.initiated_at ? format(new Date(conv.initiated_at), "PPP 'at' p") : "Unknown"}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {conv.status && (
                            <Badge variant={statusBadgeProps.variant} className={statusBadgeProps.className}>
                              {conv.status}
                            </Badge>
                          )}
                          {conv.outcome && (
                            <Badge variant={outcomeBadgeProps.variant} className={outcomeBadgeProps.className}>
                              {conv.outcome}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {conv.satisfaction_score !== undefined && conv.satisfaction_score !== null && (
                      <CardContent className="text-sm pl-[60px]">
                        <p className="text-zinc-500">Satisfaction: {conv.satisfaction_score}/10</p>
                      </CardContent>
                    )}
                  </Card>
                );
              }
              return null;
            })
          )}
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4">
          {data.appointments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-zinc-500">
                No appointments yet
              </CardContent>
            </Card>
          ) : (
            data.appointments.map((apt) => (
              <Card key={apt.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{apt.service_type}</CardTitle>
                      <CardDescription>
                        {format(new Date(apt.appointment_datetime), "PPP 'at' p")}
                      </CardDescription>
                    </div>
                    {(() => {
                      const badgeProps = getStatusBadgeProps(apt.status);
                      return (
                        <Badge variant={badgeProps.variant} className={badgeProps.className}>
                          {apt.status}
                        </Badge>
                      );
                    })()}
                  </div>
                </CardHeader>
                <CardContent className="text-sm">
                  {apt.provider && <p className="text-zinc-500">Provider: {apt.provider}</p>}
                  {apt.special_requests && <p className="mt-2 text-zinc-700">{apt.special_requests}</p>}
                  <p className="text-xs text-zinc-400 mt-2">Booked by {apt.booked_by}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="calls" className="space-y-4">
          {data.calls.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-zinc-500">
                No calls yet
              </CardContent>
            </Card>
          ) : (
            data.calls.map((call) => (
              <Card key={call.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">Voice Call</CardTitle>
                      <CardDescription>
                        {call.started_at ? format(new Date(call.started_at), "PPP 'at' p") : "Unknown"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {call.outcome && (() => {
                        const badgeProps = getStatusBadgeProps(call.outcome);
                        return (
                          <Badge variant={badgeProps.variant} className={badgeProps.className}>
                            {call.outcome}
                          </Badge>
                        );
                      })()}
                      {call.escalated && (
                        <Badge variant="outline" className="border-red-200 bg-red-100 text-red-700">
                          Escalated
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  {call.duration_seconds && (
                    <p className="text-zinc-500">Duration: {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s</p>
                  )}
                  {call.satisfaction_score !== undefined && call.satisfaction_score !== null && (
                    <p className="text-zinc-500">Satisfaction: {call.satisfaction_score}/10</p>
                  )}
                  {call.sentiment && (
                    <p className="text-zinc-500">Sentiment: {call.sentiment}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          {data.conversations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-zinc-500">
                No messages yet
              </CardContent>
            </Card>
          ) : (
            data.conversations.map((conv) => (
              <Card key={conv.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg capitalize">{conv.channel} Conversation</CardTitle>
                      <CardDescription>
                        {conv.initiated_at ? format(new Date(conv.initiated_at), "PPP 'at' p") : "Unknown"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {conv.status && (() => {
                        const badgeProps = getStatusBadgeProps(conv.status);
                        return (
                          <Badge variant={badgeProps.variant} className={badgeProps.className}>
                            {conv.status}
                          </Badge>
                        );
                      })()}
                      {conv.outcome && (() => {
                        const badgeProps = getStatusBadgeProps(conv.outcome);
                        return (
                          <Badge variant={badgeProps.variant} className={badgeProps.className}>
                            {conv.outcome}
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>
                </CardHeader>
                {conv.satisfaction_score !== undefined && conv.satisfaction_score !== null && (
                  <CardContent className="text-sm">
                    <p className="text-zinc-500">Satisfaction: {conv.satisfaction_score}/10</p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
