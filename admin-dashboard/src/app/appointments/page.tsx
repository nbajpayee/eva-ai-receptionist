"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, User, Download, ChevronRight } from "lucide-react";
import { format, parseISO, isFuture, isPast } from "date-fns";
import { exportToCSV, generateExportFilename } from "@/lib/export-utils";
import { AppointmentCardSkeletonList } from "@/components/skeletons/appointment-card-skeleton";

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

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const response = await fetch("/api/admin/appointments");

        if (!response.ok) {
          console.warn("Failed to fetch appointments", response.statusText);
          return;
        }

        const data = (await response.json()) as AppointmentsResponse;
        setAppointments(data.appointments || []);
      } catch (error) {
        console.error("Error fetching appointments", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppointments();
  }, []);

  // Filter appointments
  const filteredAppointments = appointments.filter((apt) => {
    // Status filter
    if (statusFilter !== "all" && apt.status !== statusFilter) {
      return false;
    }

    // Time filter
    if (timeFilter !== "all") {
      const aptDate = parseISO(apt.appointment_datetime);
      if (timeFilter === "upcoming" && !isFuture(aptDate)) return false;
      if (timeFilter === "past" && !isPast(aptDate)) return false;
    }

    return true;
  });

  const handleExport = () => {
    const exportData = filteredAppointments.map((apt) => ({
      ID: apt.id,
      "Customer": apt.customer?.name || "N/A",
      "Phone": apt.customer?.phone || "N/A",
      "Service": apt.service_type,
      "Provider": apt.provider || "N/A",
      "Date & Time": format(parseISO(apt.appointment_datetime), "yyyy-MM-dd HH:mm"),
      "Duration (min)": apt.duration_minutes,
      "Status": apt.status,
      "Booked By": apt.booked_by,
      "Special Requests": apt.special_requests || "N/A",
      "Created": format(parseISO(apt.created_at), "yyyy-MM-dd"),
    }));

    exportToCSV(exportData, generateExportFilename("appointments"));
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-zinc-900">Appointments</h1>
          <p className="text-sm text-zinc-500">
            Manage and track all scheduled appointments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={filteredAppointments.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <span className="text-sm font-medium text-zinc-700">Filter:</span>

        <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as "all" | "upcoming" | "past")}>
          <SelectTrigger className="w-[130px] bg-white">
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Times</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="past">Past</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as Appointment["status"] | "all")}>
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
    </div>
  );
}
