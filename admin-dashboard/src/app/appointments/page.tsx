"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, Clock, User } from "lucide-react";
import Link from "next/link";

type Appointment = {
  id: number;
  customer_id: number;
  calendar_event_id: string;
  appointment_datetime: string;
  service_type: string;
  provider: string | null;
  duration_minutes: number;
  status: "scheduled" | "completed" | "cancelled" | "no_show" | "rescheduled";
  special_requests: string | null;
  booked_by: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

type AppointmentsResponse = {
  appointments: Appointment[];
};

const statusColors: Record<Appointment["status"], string> = {
  scheduled: "bg-sky-50 text-sky-700 border-sky-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  no_show: "bg-amber-50 text-amber-700 border-amber-200",
  rescheduled: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function AppointmentsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    fetchAppointments();
  }, [currentMonth, currentYear]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      // Fetch appointments for the current month
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0);

      const response = await fetch(
        `/api/admin/appointments?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch appointments");
      }

      const data: AppointmentsResponse = await response.json();
      setAppointments(data.appointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(currentYear, currentMonth, day));
    }

    return days;
  };

  const getAppointmentsForDate = (date: Date | null) => {
    if (!date) return [];

    return appointments.filter((apt) => {
      const aptDate = new Date(apt.appointment_datetime);
      return (
        aptDate.getDate() === date.getDate() &&
        aptDate.getMonth() === date.getMonth() &&
        aptDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const days = getDaysInMonth();
  const selectedDateAppointments = selectedDate ? getAppointmentsForDate(selectedDate) : [];

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Appointments Calendar</h1>
            <p className="mt-1 text-sm text-zinc-500">View and manage scheduled appointments</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/">Back to Dashboard</Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar View */}
          <Card className="border-zinc-200 lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {MONTHS[currentMonth]} {currentYear}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={previousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-zinc-500">Loading appointments...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Days of week header */}
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <div
                        key={day}
                        className="text-center text-xs font-medium uppercase tracking-wide text-zinc-500"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {days.map((date, index) => {
                      const dayAppointments = getAppointmentsForDate(date);
                      const isSelected = selectedDate && date &&
                        selectedDate.getDate() === date.getDate() &&
                        selectedDate.getMonth() === date.getMonth();

                      return (
                        <button
                          key={index}
                          onClick={() => date && setSelectedDate(date)}
                          disabled={!date}
                          className={`
                            min-h-[80px] rounded-lg border p-2 text-left transition-colors
                            ${!date ? "invisible" : ""}
                            ${isToday(date) ? "border-sky-500 bg-sky-50/50" : "border-zinc-200 bg-white"}
                            ${isSelected ? "ring-2 ring-sky-500" : ""}
                            ${date && !isSelected ? "hover:bg-zinc-50" : ""}
                            disabled:cursor-not-allowed
                          `}
                        >
                          {date && (
                            <>
                              <div className="mb-1 flex items-center justify-between">
                                <span className={`text-sm font-medium ${isToday(date) ? "text-sky-700" : "text-zinc-900"}`}>
                                  {date.getDate()}
                                </span>
                                {dayAppointments.length > 0 && (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-xs font-medium text-sky-700">
                                    {dayAppointments.length}
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1">
                                {dayAppointments.slice(0, 2).map((apt) => (
                                  <div
                                    key={apt.id}
                                    className="truncate rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-700"
                                  >
                                    {new Date(apt.appointment_datetime).toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    })}
                                  </div>
                                ))}
                                {dayAppointments.length > 2 && (
                                  <div className="text-xs text-zinc-500">
                                    +{dayAppointments.length - 2} more
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appointments List for Selected Date */}
          <Card className="border-zinc-200">
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedDate
                  ? `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`
                  : "Select a date"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedDate ? (
                <p className="text-center text-sm text-zinc-500">
                  Click on a date to view appointments
                </p>
              ) : selectedDateAppointments.length === 0 ? (
                <p className="text-center text-sm text-zinc-500">
                  No appointments scheduled
                </p>
              ) : (
                <div className="space-y-4">
                  {selectedDateAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="rounded-lg border border-zinc-200 bg-white p-4"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-zinc-400" />
                          <span className="text-sm font-medium text-zinc-900">
                            {apt.service_type}
                          </span>
                        </div>
                        <Badge variant="outline" className={statusColors[apt.status]}>
                          {apt.status}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm text-zinc-600">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-zinc-400" />
                          <span>
                            {new Date(apt.appointment_datetime).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                            {" "}({apt.duration_minutes} min)
                          </span>
                        </div>

                        {apt.provider && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-zinc-400" />
                            <span>{apt.provider}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
