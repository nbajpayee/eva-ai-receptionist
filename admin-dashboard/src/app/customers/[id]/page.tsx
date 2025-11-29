"use client";

import { use, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit2, Trash2, Save, X, Phone, Mail, AlertTriangle, Baby, Calendar, MessageSquare, Headphones, TrendingUp, DollarSign, Star, Activity, Send, CalendarPlus, Clock, UserX } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    case "confirmed":
      return { 
        variant: "outline" as const,
        className: "border-emerald-200 bg-emerald-100 text-emerald-700"
      };
    case "cancelled":
    case "canceled":
    case "failed":
      return {
        variant: "outline" as const,
        className: "border-red-200 bg-red-100 text-red-700",
      };
    case "active":
    case "scheduled":
      return { 
        variant: "default" as const,
        className: "bg-primary hover:bg-primary/90"
      };
    case "pending":
      return { 
        variant: "outline" as const,
        className: "border-amber-200 bg-amber-100 text-amber-700"
      };
    default:
      return { variant: "secondary" as const };
  }
}

// Type guard functions for timeline items
function isAppointmentItem(item: TimelineItem): item is TimelineItem & { type: 'appointment'; data: Appointment } {
  return item.type === 'appointment';
}

function isCallItem(item: TimelineItem): item is TimelineItem & { type: 'call'; data: Call } {
  return item.type === 'call';
}

function isConversationItem(item: TimelineItem): item is TimelineItem & { type: 'conversation'; data: Conversation } {
  return item.type === 'conversation';
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

interface CustomerTimelineResponse {
  customer: Customer;
  appointments: Appointment[];
  calls: Call[];
  conversations: Conversation[];
  stats: CustomerStats;
}

type TimelineItem = {
  type: 'appointment' | 'call' | 'conversation';
  date: Date;
  data: Appointment | Call | Conversation;
};

// Constants for calculations
const AVG_APPOINTMENT_VALUE = 350; // Average revenue per completed appointment

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [data, setData] = useState<CustomerHistory | null>(null);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Create unified timeline from all interactions (memoized for performance)
  const timeline = useMemo((): TimelineItem[] => {
    if (!data) return [];

    const items: TimelineItem[] = [];

    // Add appointments (with date validation)
    data.appointments.forEach(apt => {
      try {
        const date = new Date(apt.appointment_datetime);
        if (!isNaN(date.getTime())) {
          items.push({
            type: 'appointment',
            date,
            data: apt
          });
        }
      } catch (e) {
        console.error('Invalid appointment date:', apt.appointment_datetime);
      }
    });

    // Add calls (with date validation)
    data.calls.forEach(call => {
      if (call.started_at) {
        try {
          const date = new Date(call.started_at);
          if (!isNaN(date.getTime())) {
            items.push({
              type: 'call',
              date,
              data: call
            });
          }
        } catch (e) {
          console.error('Invalid call date:', call.started_at);
        }
      }
    });

    // Add conversations (with date validation)
    data.conversations.forEach(conv => {
      if (conv.initiated_at) {
        try {
          const date = new Date(conv.initiated_at);
          if (!isNaN(date.getTime())) {
            items.push({
              type: 'conversation',
              date,
              data: conv
            });
          }
        } catch (e) {
          console.error('Invalid conversation date:', conv.initiated_at);
        }
      }
    });

    // Sort by date (most recent first)
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [data]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/admin/customers/${id}/timeline`);

        if (!response.ok) {
          throw new Error("Failed to fetch customer timeline");
        }

        const timelineData: CustomerTimelineResponse = await response.json();

        // Only update state if component is still mounted
        if (isMounted) {
          const history: CustomerHistory = {
            customer: timelineData.customer,
            appointments: timelineData.appointments,
            calls: timelineData.calls,
            conversations: timelineData.conversations,
          };

          setData(history);
          setStats(timelineData.stats);
          setEditForm(timelineData.customer);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/customers/${id}`, {
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
      const response = await fetch(`/api/admin/customers/${id}`, {
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
        <p className="text-sm text-destructive">Error: {error || "Customer not found"}</p>
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
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {customer.name}
              {customer.is_new_client && (
                <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0">
                  New Client
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">Customer ID: {customer.id}</p>
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
              <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-to-r from-primary to-teal-500 hover:from-primary/90 hover:to-teal-500/90 text-white border-0">
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks for this customer</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Link href={`/messaging?customer_id=${customer.id}`}>
            <Button className="bg-gradient-to-r from-primary to-teal-500 hover:from-primary/90 hover:to-teal-500/90 text-white border-0" aria-label="Send message to customer">
              <Send className="mr-2 h-4 w-4" />
              Send Message
            </Button>
          </Link>
          <Link href={`/appointments?customer_id=${customer.id}&action=new`}>
            <Button variant="outline" className="hover:bg-primary hover:text-white hover:border-primary" aria-label="Book new appointment for customer">
              <CalendarPlus className="mr-2 h-4 w-4" />
              Book Appointment
            </Button>
          </Link>
          {customer.phone && (
            <a href={`tel:${customer.phone}`} aria-label={`Call customer at ${customer.phone}`}>
              <Button variant="outline" className="hover:bg-emerald-500 hover:text-white hover:border-emerald-500">
                <Phone className="mr-2 h-4 w-4" />
                Call
              </Button>
            </a>
          )}
          {customer.email && (
            <a href={`mailto:${customer.email}`} aria-label={`Email customer at ${customer.email}`}>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="h-4 w-4 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 w-32 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {/* Lifetime Value - Calculated from completed appointments */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lifetime Value</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(stats.completed_appointments * AVG_APPOINTMENT_VALUE).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Est. from {stats.completed_appointments} completed appointments
              </p>
            </CardContent>
          </Card>

          {/* Total Appointments */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Appointments</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_appointments}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.completed_appointments} completed • {stats.cancelled_appointments} cancelled
              </p>
            </CardContent>
          </Card>

          {/* Satisfaction Score */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
              <Star className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.avg_satisfaction_score !== null
                  ? `${stats.avg_satisfaction_score.toFixed(1)}/10`
                  : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                From {stats.total_calls} voice calls
              </p>
            </CardContent>
          </Card>

          {/* Total Interactions */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
              <Activity className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.total_calls + stats.total_conversations}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total_calls} calls • {stats.total_conversations} messages
              </p>
            </CardContent>
          </Card>

          {/* No Show Rate */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">No Show Rate</CardTitle>
              <UserX className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.total_appointments > 0 ? `${stats.no_show_rate.toFixed(1)}%` : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total_appointments > 0
                  ? `${stats.cancelled_appointments} of ${stats.total_appointments} appts`
                  : "No appointments yet"}
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
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p className="flex items-center gap-2 text-foreground font-medium">
                    <Phone className="h-4 w-4 text-primary" />
                    {customer.phone}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="flex items-center gap-2 text-foreground font-medium">
                    <Mail className="h-4 w-4 text-primary" />
                    {customer.email || "Not provided"}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Medical Screening</label>
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
                    <Badge className="bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200">
                      <Baby className="mr-1 h-3 w-3" />
                      Pregnant
                    </Badge>
                  )}
                  {!customer.has_allergies && !customer.is_pregnant && (
                    <Badge variant="outline" className="text-zinc-600 bg-zinc-50 border-zinc-200">
                      No medical flags
                    </Badge>
                  )}
                </div>
              </div>

              {customer.notes && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Notes</label>
                  <div className="mt-1 p-3 bg-muted/30 rounded-md border border-border/50">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{customer.notes}</p>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground pt-2 border-t">
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
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone || ""}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={editForm.email || ""}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.has_allergies || false}
                    onChange={(e) => setEditForm({ ...editForm, has_allergies: e.target.checked })}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Has allergies</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_pregnant || false}
                    onChange={(e) => setEditForm({ ...editForm, is_pregnant: e.target.checked })}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Is pregnant</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_new_client !== undefined ? !editForm.is_new_client : false}
                    onChange={(e) => setEditForm({ ...editForm, is_new_client: !e.target.checked })}
                    className="rounded border-input text-primary focus:ring-primary"
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
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  placeholder="Add any notes about this customer..."
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Tabs */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="bg-zinc-100 p-1">
          <TabsTrigger value="timeline" className="text-zinc-700 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <Clock className="mr-2 h-4 w-4" />
            Timeline ({timeline.length})
          </TabsTrigger>
          <TabsTrigger value="appointments" className="text-zinc-700 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <Calendar className="mr-2 h-4 w-4" />
            Appointments ({data.appointments.length})
          </TabsTrigger>
          <TabsTrigger value="calls" className="text-zinc-700 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <Headphones className="mr-2 h-4 w-4" />
            Calls ({data.calls.length})
          </TabsTrigger>
          <TabsTrigger value="messages" className="text-zinc-700 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <MessageSquare className="mr-2 h-4 w-4" />
            Messages ({data.conversations.length})
          </TabsTrigger>
        </TabsList>

        {/* Unified Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4 pt-4">
          {timeline.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
                <Clock className="h-10 w-10 mb-4 opacity-20" />
                No activity recorded yet for this customer.
              </CardContent>
            </Card>
          ) : (
            timeline.map((item, index) => {
              if (isAppointmentItem(item)) {
                const badgeProps = getStatusBadgeProps(item.data.status);
                return (
                  <Card key={`apt-${item.data.id}-${index}`} className="group hover:shadow-md transition-all hover:border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 p-2 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                            <Calendar className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-semibold text-foreground">
                              Appointment: {item.data.service_type}
                            </CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {format(new Date(item.data.appointment_datetime), "PPP 'at' p")}
                              {" • "}
                              {formatDistanceToNow(new Date(item.data.appointment_datetime), { addSuffix: true })}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant={badgeProps.variant} className={badgeProps.className}>
                          {item.data.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm pl-[60px] pb-4">
                      {item.data.provider && <p className="text-muted-foreground">Provider: <span className="font-medium text-foreground">{item.data.provider}</span></p>}
                      {item.data.special_requests && (
                        <div className="mt-2 p-2 bg-amber-50 text-amber-900 text-xs rounded border border-amber-100 flex gap-2 items-start">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>{item.data.special_requests}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        Booked by {item.data.booked_by}
                      </p>
                    </CardContent>
                  </Card>
                );
              } else if (isCallItem(item)) {
                const badgeProps = getStatusBadgeProps(item.data.outcome);
                const callDate = item.data.started_at
                  ? formatDistanceToNow(new Date(item.data.started_at), { addSuffix: true })
                  : "unknown time";
                return (
                  <Link
                    href={`/conversations/${item.data.id}`}
                    key={`call-${item.data.id}-${index}`}
                    aria-label={`View voice call details from ${callDate}`}
                    className="block"
                  >
                    <Card className="group hover:shadow-md transition-all hover:border-emerald-200 cursor-pointer">
                      <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 p-2 bg-emerald-100 rounded-full group-hover:bg-emerald-200 transition-colors">
                            <Headphones className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-semibold text-foreground">Voice Call</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {item.data.started_at ? (
                                <>
                                  {format(new Date(item.data.started_at), "PPP 'at' p")}
                                  {" • "}
                                  {formatDistanceToNow(new Date(item.data.started_at), { addSuffix: true })}
                                </>
                              ) : "Unknown"}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.data.outcome && (
                            <Badge variant={badgeProps.variant} className={badgeProps.className}>
                              {item.data.outcome}
                            </Badge>
                          )}
                          {item.data.escalated && (
                            <Badge variant="outline" className="border-red-200 bg-red-100 text-red-700 animate-pulse">
                              Escalated
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1 pl-[60px] pb-4">
                      {item.data.duration_seconds && (
                        <p className="text-muted-foreground">Duration: {Math.floor(item.data.duration_seconds / 60)}m {item.data.duration_seconds % 60}s</p>
                      )}
                      <div className="flex gap-3 mt-2">
                        {item.data.satisfaction_score !== undefined && item.data.satisfaction_score !== null && (
                          <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                            <Star className="h-3 w-3 fill-amber-600" />
                            {item.data.satisfaction_score}/10
                          </div>
                        )}
                        {item.data.sentiment && (
                          <div className="flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded-full border border-slate-100 capitalize">
                            <Activity className="h-3 w-3" />
                            {item.data.sentiment}
                          </div>
                        )}
                      </div>
                    </CardContent>
                    </Card>
                  </Link>
                );
              } else if (isConversationItem(item)) {
                const statusBadgeProps = getStatusBadgeProps(item.data.status);
                const outcomeBadgeProps = getStatusBadgeProps(item.data.outcome);
                return (
                  <Card key={`conv-${item.data.id}-${index}`} className="group hover:shadow-md transition-all hover:border-sky-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 p-2 bg-sky-100 rounded-full group-hover:bg-sky-200 transition-colors">
                            <MessageSquare className="h-4 w-4 text-sky-600" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-semibold text-foreground capitalize">{item.data.channel} Conversation</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {item.data.initiated_at ? (
                                <>
                                  {format(new Date(item.data.initiated_at), "PPP 'at' p")}
                                  {" • "}
                                  {formatDistanceToNow(new Date(item.data.initiated_at), { addSuffix: true })}
                                </>
                              ) : "Unknown"}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.data.status && (
                            <Badge variant={statusBadgeProps.variant} className={statusBadgeProps.className}>
                              {item.data.status}
                            </Badge>
                          )}
                          {item.data.outcome && (
                            <Badge variant={outcomeBadgeProps.variant} className={outcomeBadgeProps.className}>
                              {item.data.outcome}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {item.data.satisfaction_score !== undefined && item.data.satisfaction_score !== null && (
                      <CardContent className="text-sm pl-[60px] pb-4">
                         <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100 w-fit">
                            <Star className="h-3 w-3 fill-amber-600" />
                            {item.data.satisfaction_score}/10
                          </div>
                      </CardContent>
                    )}
                  </Card>
                );
              }
              return null;
            })
          )}
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4 pt-4">
          {data.appointments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
                <Calendar className="h-10 w-10 mb-4 opacity-20" />
                No appointments found.
              </CardContent>
            </Card>
          ) : (
            data.appointments.map((apt) => (
              <Card key={apt.id} className="hover:shadow-sm transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-medium">{apt.service_type}</CardTitle>
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
                  {apt.provider && <p className="text-muted-foreground">Provider: <span className="text-foreground">{apt.provider}</span></p>}
                  {apt.special_requests && <p className="mt-2 text-foreground bg-muted/30 p-2 rounded text-xs">{apt.special_requests}</p>}
                  <p className="text-xs text-muted-foreground mt-2">Booked by {apt.booked_by}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="calls" className="space-y-4 pt-4">
          {data.calls.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
                <Headphones className="h-10 w-10 mb-4 opacity-20" />
                No voice calls recorded.
              </CardContent>
            </Card>
          ) : (
            data.calls.map((call) => (
              <Card key={call.id} className="hover:shadow-sm transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-medium">Voice Call</CardTitle>
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
                    <p className="text-muted-foreground">Duration: {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s</p>
                  )}
                  {call.satisfaction_score !== undefined && call.satisfaction_score !== null && (
                    <p className="text-muted-foreground">Satisfaction: <span className="font-medium text-foreground">{call.satisfaction_score}/10</span></p>
                  )}
                  {call.sentiment && (
                    <p className="text-muted-foreground">Sentiment: <span className="capitalize text-foreground">{call.sentiment}</span></p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="messages" className="space-y-4 pt-4">
          {data.conversations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center">
                <MessageSquare className="h-10 w-10 mb-4 opacity-20" />
                No messages recorded.
              </CardContent>
            </Card>
          ) : (
            data.conversations.map((conv) => (
              <Card key={conv.id} className="hover:shadow-sm transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-medium capitalize">{conv.channel} Conversation</CardTitle>
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
                    <p className="text-muted-foreground">Satisfaction: <span className="font-medium text-foreground">{conv.satisfaction_score}/10</span></p>
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
