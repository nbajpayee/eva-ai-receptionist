"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, User, Download, ChevronRight } from "lucide-react";
import { addDays, format, parseISO, isFuture, isPast } from "date-fns";
import { exportToCSV, generateExportFilename } from "@/lib/export-utils";
import { AppointmentCardSkeletonList } from "@/components/skeletons/appointment-card-skeleton";
import { BookAppointmentDialog } from "@/components/book-appointment-dialog";

interface Appointment {
  id: number;
  customer_id: number;
  calendar_event_id?: string;
  appointment_datetime: string;
  service_type: string;
  provider?: string;
  duration_minutes: number;
  status: "scheduled" | "completed" | "cancelled" | "no_show" | "rescheduled";
  booked_by: string;
  special_requests?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
  customer?: {
    id: number;
    name: string;
    phone: string;
    email?: string;
  };
}

interface AppointmentsResponse {
  appointments: Appointment[];
  total: number;
}

interface AppointmentRequestCustomer {
  id: number;
  name: string;
  phone?: string | null;
}

interface AppointmentRequest {
  id: string;
  created_at: string;
  channel: string;
  status: string;
  requested_time_window?: string | null;
  service_type?: string | null;
  customer?: AppointmentRequestCustomer | null;
  note?: string | null;
}

interface AppointmentRequestsResponse {
  requests: AppointmentRequest[];
}

const STATUS_LABELS: Record<Appointment["status"], string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
  rescheduled: "Rescheduled",
};

const STATUS_COLORS: Record<Appointment["status"], string> = {
  scheduled: "bg-sky-50 text-sky-700 border-sky-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  no_show: "bg-amber-50 text-amber-700 border-amber-200",
  rescheduled: "bg-violet-50 text-violet-700 border-violet-200",
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Appointment["status"] | "all">("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "upcoming" | "past">("all");
  const [scheduleWindow, setScheduleWindow] = useState<"today" | "next7" | "all">("today");
  const [scheduleProvider, setScheduleProvider] = useState<string | "all">("all");
  const [requestItems, setRequestItems] = useState<AppointmentRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [dismissingRequestId, setDismissingRequestId] = useState<string | null>(null);
  const [requestStatusFilter, setRequestStatusFilter] = useState<
    "all" | "new" | "in_progress" | "booked" | "dismissed"
  >("all");
  const [requestChannelFilter, setRequestChannelFilter] = useState<
    "all" | "voice" | "sms" | "email" | "web"
  >("all");
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [tab, setTab] = useState<"schedule" | "requests" | "history">("schedule");
  const [isBookDialogOpen, setIsBookDialogOpen] = useState(false);
  const [dialogInitialCustomer, setDialogInitialCustomer] = useState<{
    id: number;
    name: string;
    phone?: string | null;
    email?: string | null;
  } | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam === "schedule" || viewParam === "requests" || viewParam === "history") {
      setTab(viewParam);
    }
  }, [searchParams]);

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/appointments");

      if (!response.ok) {
        console.warn("Failed to fetch appointments", response.statusText);
        setAppointments([]);
        return;
      }

      const data = (await response.json()) as AppointmentsResponse;
      setAppointments(data.appointments || []);
    } catch (error) {
      console.error("Error fetching appointments", error);
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAppointments();
  }, [fetchAppointments]);

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const response = await fetch("/api/admin/appointments/requests");

      if (!response.ok) {
        console.warn("Failed to fetch appointment requests", response.statusText);
        setRequestsError("Unable to load appointment requests right now.");
        setRequestItems([]);
        setRequestNotes({});
        return;
      }

      const data = (await response.json()) as AppointmentRequestsResponse;
      const requests = data.requests || [];
      setRequestItems(requests);

      const initialNotes: Record<string, string> = {};
      for (const req of requests) {
        if ((req as any).note) {
          initialNotes[req.id] = (req as any).note ?? "";
        }
      }
      setRequestNotes(initialNotes);
    } catch (error) {
      console.error("Error fetching appointment requests", error);
      setRequestsError("Unable to load appointment requests right now.");
      setRequestItems([]);
      setRequestNotes({});
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    const action = searchParams.get("action");
    const customerIdParam = searchParams.get("customer_id");

    if (action !== "new" || !customerIdParam) {
      return;
    }

    const customerId = Number(customerIdParam);
    if (Number.isNaN(customerId)) {
      return;
    }

    const loadCustomerAndOpen = async () => {
      try {
        const response = await fetch(`/api/admin/customers/${customerId}`);

        if (!response.ok) {
          console.warn(
            "Failed to fetch customer for new booking dialog",
            response.statusText,
          );
          setDialogInitialCustomer({
            id: customerId,
            name: `Customer #${customerId}`,
          });
        } else {
          const customer = (await response.json()) as {
            id: number;
            name: string;
            phone?: string | null;
            email?: string | null;
          };
          setDialogInitialCustomer({
            id: customer.id,
            name: customer.name,
            phone: customer.phone ?? null,
            email: customer.email ?? null,
          });
        }
      } catch (error) {
        console.error("Error preparing new booking dialog for customer", error);
        setDialogInitialCustomer({
          id: customerId,
          name: `Customer #${customerId}`,
        });
      } finally {
        setIsBookDialogOpen(true);
        setTab("schedule");
        const params = new URLSearchParams(searchParams.toString());
        params.delete("action");
        params.delete("customer_id");
        const query = params.toString();
        router.replace(query ? `/appointments?${query}` : "/appointments");
      }
    };

    void loadCustomerAndOpen();
  }, [searchParams, router]);

  // Filter appointments for history
  const filteredAppointments = appointments.filter((apt) => {
    if (statusFilter !== "all" && apt.status !== statusFilter) {
      return false;
    }

    if (timeFilter !== "all") {
      const aptDate = parseISO(apt.appointment_datetime);
      if (timeFilter === "upcoming" && !isFuture(aptDate)) return false;
      if (timeFilter === "past" && !isPast(aptDate)) return false;
    }

    return true;
  });

  const upcomingAppointments = appointments.filter((apt) => {
    const aptDate = parseISO(apt.appointment_datetime);
    return isFuture(aptDate);
  });

  const now = new Date();
  const next7 = addDays(now, 7);

  const scheduleAppointments = upcomingAppointments.filter((apt) => {
    const aptDate = parseISO(apt.appointment_datetime);

    if (scheduleWindow === "today") {
      if (aptDate.toDateString() !== now.toDateString()) return false;
    } else if (scheduleWindow === "next7") {
      if (!(aptDate >= now && aptDate <= next7)) return false;
    }

    if (scheduleProvider !== "all") {
      if (!apt.provider || apt.provider !== scheduleProvider) return false;
    }

    return true;
  });

  const providerOptions = Array.from(
    new Set(
      appointments
        .map((apt) => apt.provider)
        .filter((p): p is string => Boolean(p))
    )
  );

  const filteredRequests = requestItems.filter((req) => {
    if (requestStatusFilter !== "all" && req.status !== requestStatusFilter) {
      return false;
    }

    if (requestChannelFilter !== "all" && req.channel !== requestChannelFilter) {
      return false;
    }

    return true;
  });

  const handleExport = () => {
    const exportData = filteredAppointments.map((apt) => ({
      ID: apt.id,
      Customer: apt.customer?.name || "N/A",
      Phone: apt.customer?.phone || "N/A",
      Service: apt.service_type,
      Provider: apt.provider || "N/A",
      "Date & Time": format(parseISO(apt.appointment_datetime), "yyyy-MM-dd HH:mm"),
      "Duration (min)": apt.duration_minutes,
      Status: apt.status,
      "Booked By": apt.booked_by,
      "Special Requests": apt.special_requests || "N/A",
      Created: format(parseISO(apt.created_at), "yyyy-MM-dd"),
    }));

    exportToCSV(exportData, generateExportFilename("appointments"));
  };

  const handleDismissRequest = async (id: string) => {
    setDismissingRequestId(id);
    try {
      const response = await fetch(`/api/admin/appointments/requests/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "dismissed" }),
      });

      if (!response.ok) {
        console.warn("Failed to dismiss appointment request", response.statusText);
        return;
      }
      await fetchRequests();
    } catch (error) {
      console.error("Error dismissing appointment request", error);
    } finally {
      setDismissingRequestId(null);
    }
  };

  const handleSaveRequestNote = async (id: string) => {
    const note = (requestNotes[id] ?? "").trim();
    setSavingNoteId(id);
    try {
      const response = await fetch(`/api/admin/appointments/requests/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note: note === "" ? null : note }),
      });

      if (!response.ok) {
        console.warn("Failed to save note for appointment request", response.statusText);
        return;
      }

      await fetchRequests();
    } catch (error) {
      console.error("Error saving note for appointment request", error);
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleTabChange = (value: string) => {
    if (value !== "schedule" && value !== "requests" && value !== "history") {
      return;
    }

    setTab(value);

    const params = new URLSearchParams(searchParams.toString());
    params.set("view", value);
    const query = params.toString();
    router.replace(query ? `/appointments?${query}` : "/appointments");
  };

  const handleBookingSuccess = useCallback(async () => {
    await fetchAppointments();
    await fetchRequests();
  }, [fetchAppointments, fetchRequests]);

  const handleNewBookingClick = () => {
    setDialogInitialCustomer(null);
    setIsBookDialogOpen(true);
    setTab("schedule");
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-zinc-900">Appointments</h1>
          <p className="text-sm text-zinc-500">
            Review today&apos;s schedule, booking opportunities, and full history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleNewBookingClick}>
            <Calendar className="mr-2 h-4 w-4" />
            New Booking
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={filteredAppointments.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-4">
          {isLoading && <AppointmentCardSkeletonList count={5} />}

          {!isLoading && (
            <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <span className="text-sm font-medium text-zinc-700">Schedule for:</span>

              <Select
                value={scheduleWindow}
                onValueChange={(value: "today" | "next7" | "all") => {
                  setScheduleWindow(value);
                }}
              >
                <SelectTrigger className="w-[150px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="next7">Next 7 days</SelectItem>
                  <SelectItem value="all">All upcoming</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={scheduleProvider}
                onValueChange={(value: string | "all") => {
                  setScheduleProvider(value);
                }}
              >
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder="All providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All providers</SelectItem>
                  {providerOptions.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="ml-auto text-sm text-zinc-500">
                Showing {scheduleAppointments.length} of {upcomingAppointments.length} upcoming
              </span>
            </div>
          )}

          {!isLoading && upcomingAppointments.length === 0 && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
              <p className="text-sm text-zinc-600">
                No upcoming appointments. New bookings will appear here.
              </p>
            </div>
          )}

          {!isLoading && upcomingAppointments.length > 0 && scheduleAppointments.length === 0 && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
              <p className="text-sm text-zinc-600">
                No appointments match your schedule filters.
              </p>
            </div>
          )}

          {!isLoading && scheduleAppointments.length > 0 && (
            <div className="grid gap-4">
              {scheduleAppointments.map((apt) => {
                const aptDate = parseISO(apt.appointment_datetime);
                const isUpcoming = isFuture(aptDate);

                return (
                  <Card key={apt.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg font-semibold">{apt.service_type}</CardTitle>
                            <Badge
                              variant="outline"
                              className={`${STATUS_COLORS[apt.status]} font-medium text-xs`}
                            >
                              {STATUS_LABELS[apt.status]}
                            </Badge>
                            {isUpcoming && apt.status === "scheduled" && (
                              <Badge variant="default" className="bg-blue-600 text-xs">
                                Upcoming
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-zinc-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(aptDate, "EEE, MMM d, yyyy")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {format(aptDate, "h:mm a")} ({apt.duration_minutes} min)
                            </span>
                            {apt.provider && (
                              <span className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                {apt.provider}
                              </span>
                            )}
                          </div>

                          {apt.customer && (
                            <div className="text-sm text-zinc-600">
                              <span className="font-medium">Customer:</span> {apt.customer.name} ({apt.customer.phone})
                            </div>
                          )}

                          {apt.special_requests && (
                            <div className="text-sm text-zinc-600">
                              <span className="font-medium">Notes:</span> {apt.special_requests}
                            </div>
                          )}

                          {apt.cancellation_reason && (
                            <div className="text-sm text-rose-600">
                              <span className="font-medium">Cancellation Reason:</span> {apt.cancellation_reason}
                            </div>
                          )}
                        </div>

                        <Link href={`/customers/${apt.customer_id}`}>
                          <Button variant="outline" size="sm">
                            View Customer
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3 border-t border-zinc-100">
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>Booked by: {apt.booked_by}</span>
                        <span>Created: {format(parseISO(apt.created_at), "MMM d, yyyy")}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          {requestsLoading && <AppointmentCardSkeletonList count={3} />}

          {!requestsLoading && requestsError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {requestsError}
            </div>
          )}

          {!requestsLoading && !requestsError && requestItems.length === 0 && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
              <p className="text-sm text-zinc-600">
                No appointment requests right now.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                When Eva collects booking intent that doesn&apos;t become an appointment, it will appear here.
              </p>
            </div>
          )}

          {!requestsLoading && !requestsError && requestItems.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <span className="text-sm font-medium text-zinc-700">Filter:</span>

              <Select
                value={requestStatusFilter}
                onValueChange={(value: "all" | "new" | "in_progress" | "booked" | "dismissed") => {
                  setRequestStatusFilter(value);
                }}
              >
                <SelectTrigger className="w-[150px] bg-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={requestChannelFilter}
                onValueChange={(value: "all" | "voice" | "sms" | "email" | "web") => {
                  setRequestChannelFilter(value);
                }}
              >
                <SelectTrigger className="w-[150px] bg-white">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="voice">Voice</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                </SelectContent>
              </Select>

              {(requestStatusFilter !== "all" || requestChannelFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRequestStatusFilter("all");
                    setRequestChannelFilter("all");
                  }}
                >
                  Clear Filters
                </Button>
              )}

              <span className="ml-auto text-sm text-zinc-500">
                Showing {filteredRequests.length} of {requestItems.length} requests
              </span>
            </div>
          )}

          {!requestsLoading && !requestsError && requestItems.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Pending Appointment Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-zinc-200 text-xs text-zinc-500">
                      <tr className="text-left">
                        <th className="py-2 pr-4 font-medium">Created</th>
                        <th className="py-2 pr-4 font-medium">Channel</th>
                        <th className="py-2 pr-4 font-medium">Customer</th>
                        <th className="py-2 pr-4 font-medium">Requested Time</th>
                        <th className="py-2 pr-4 font-medium">Service</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Notes</th>
                        <th className="py-2 pr-0 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredRequests.map((req) => {
                        const noteValue = requestNotes[req.id] ?? (req as any).note ?? "";
                        return (
                        <tr key={req.id}>
                          <td className="py-2 pr-4 whitespace-nowrap text-zinc-700">
                            {req.created_at
                              ? format(parseISO(req.created_at), "MMM d, yyyy HH:mm")
                              : "Unknown"}
                          </td>
                          <td className="py-2 pr-4 capitalize text-zinc-700">{req.channel || "—"}</td>
                          <td className="py-2 pr-4">
                            {req.customer ? (
                              <div className="flex flex-col">
                                <span className="font-medium text-zinc-800">{req.customer.name}</span>
                                {req.customer.phone && (
                                  <span className="text-xs text-zinc-500">{req.customer.phone}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-zinc-500">Unknown</span>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-zinc-700">
                            {req.requested_time_window || "—"}
                          </td>
                          <td className="py-2 pr-4 text-zinc-700">
                            {req.service_type || "—"}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge variant="outline" className="text-xs capitalize">
                              {req.status || "pending"}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 align-top">
                            <textarea
                              className="w-full rounded-md border border-zinc-200 bg-white p-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                              rows={2}
                              value={noteValue}
                              onChange={(e) => {
                                const value = e.target.value;
                                setRequestNotes((prev) => ({
                                  ...prev,
                                  [req.id]: value,
                                }));
                              }}
                              onBlur={() => {
                                void handleSaveRequestNote(req.id);
                              }}
                              placeholder="Internal notes..."
                            />
                            <div className="mt-1 flex justify-end">
                              <Button
                                variant="ghost"
                                size="xs"
                                disabled={savingNoteId === req.id}
                                onClick={() => {
                                  void handleSaveRequestNote(req.id);
                                }}
                              >
                                {savingNoteId === req.id ? "Saving..." : "Save"}
                              </Button>
                            </div>
                          </td>
                          <td className="py-2 pl-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!req.customer?.id || !req.customer.name}
                                onClick={() => {
                                  if (!req.customer?.id || !req.customer.name) return;
                                  setDialogInitialCustomer({
                                    id: req.customer.id,
                                    name: req.customer.name,
                                    phone: req.customer.phone ?? null,
                                  });
                                  setIsBookDialogOpen(true);
                                  handleTabChange("schedule");
                                }}
                              >
                                Book
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={dismissingRequestId === req.id}
                                onClick={() => {
                                  void handleDismissRequest(req.id);
                                }}
                              >
                                {dismissingRequestId === req.id ? "Dismissing..." : "Dismiss"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <span className="text-sm font-medium text-zinc-700">Filter:</span>

            <Select
              value={timeFilter}
              onValueChange={(value: "all" | "upcoming" | "past") => {
                setTimeFilter(value);
              }}
            >
              <SelectTrigger className="w-[130px] bg-white">
                <SelectValue placeholder="Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Times</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="past">Past</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(value: Appointment["status"] | "all") => {
                setStatusFilter(value);
              }}
            >
              <SelectTrigger className="w-[140px] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
                <SelectItem value="rescheduled">Rescheduled</SelectItem>
              </SelectContent>
            </Select>

            {(statusFilter !== "all" || timeFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter("all");
                  setTimeFilter("all");
                }}
              >
                Clear Filters
              </Button>
            )}

            <span className="ml-auto text-sm text-zinc-500">
              Showing {filteredAppointments.length} of {appointments.length} appointments
            </span>
          </div>

          {isLoading && <AppointmentCardSkeletonList count={5} />}

          {!isLoading && appointments.length === 0 && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
              <p className="text-sm text-zinc-600">
                No appointments found. Appointments will appear here once they are booked.
              </p>
            </div>
          )}

          {!isLoading && appointments.length > 0 && filteredAppointments.length === 0 && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
              <p className="text-sm text-zinc-600">
                No appointments match your filter criteria.
              </p>
            </div>
          )}

          {filteredAppointments.length > 0 && (
            <div className="grid gap-4">
              {filteredAppointments.map((apt) => {
                const aptDate = parseISO(apt.appointment_datetime);
                const isUpcoming = isFuture(aptDate);

                return (
                  <Card key={apt.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg font-semibold">{apt.service_type}</CardTitle>
                            <Badge
                              variant="outline"
                              className={`${STATUS_COLORS[apt.status]} font-medium text-xs`}
                            >
                              {STATUS_LABELS[apt.status]}
                            </Badge>
                            {isUpcoming && apt.status === "scheduled" && (
                              <Badge variant="default" className="bg-blue-600 text-xs">
                                Upcoming
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-zinc-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(aptDate, "EEE, MMM d, yyyy")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {format(aptDate, "h:mm a")} ({apt.duration_minutes} min)
                            </span>
                            {apt.provider && (
                              <span className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                {apt.provider}
                              </span>
                            )}
                          </div>

                          {apt.customer && (
                            <div className="text-sm text-zinc-600">
                              <span className="font-medium">Customer:</span> {apt.customer.name} ({apt.customer.phone})
                            </div>
                          )}

                          {apt.special_requests && (
                            <div className="text-sm text-zinc-600">
                              <span className="font-medium">Notes:</span> {apt.special_requests}
                            </div>
                          )}

                          {apt.cancellation_reason && (
                            <div className="text-sm text-rose-600">
                              <span className="font-medium">Cancellation Reason:</span> {apt.cancellation_reason}
                            </div>
                          )}
                        </div>

                        <Link href={`/customers/${apt.customer_id}`}>
                          <Button variant="outline" size="sm">
                            View Customer
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3 border-t border-zinc-100">
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>Booked by: {apt.booked_by}</span>
                        <span>Created: {format(parseISO(apt.created_at), "MMM d, yyyy")}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BookAppointmentDialog
        open={isBookDialogOpen}
        onOpenChange={(open) => setIsBookDialogOpen(open)}
        onSuccess={handleBookingSuccess}
        initialCustomer={dialogInitialCustomer}
      />
    </div>
  );
}
