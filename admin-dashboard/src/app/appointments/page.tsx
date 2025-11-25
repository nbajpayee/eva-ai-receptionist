"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { addDays, format, parseISO, isFuture, isPast } from "date-fns";
import { exportToCSV, generateExportFilename } from "@/lib/export-utils";
import { BookAppointmentDialog } from "@/components/book-appointment-dialog";

// Modular Components
import { ScheduleTab } from "./components/ScheduleTab";
import { RequestsTab } from "./components/RequestsTab";
import { HistoryTab } from "./components/HistoryTab";
import { Appointment, AppointmentRequest } from "./components/types";

interface AppointmentsResponse {
  appointments: Appointment[];
  total: number;
}

interface AppointmentRequestsResponse {
  requests: AppointmentRequest[];
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // History Tab Filters
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("all");
  const [historyTimeFilter, setHistoryFilter] = useState<"all" | "upcoming" | "past">("all");
  const [historySearchQuery, setHistorySearchQuery] = useState("");

  // Requests Tab State
  const [requestItems, setRequestItems] = useState<AppointmentRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestChannelFilter, setRequestChannelFilter] = useState<"all" | "voice" | "sms" | "email" | "web">("all");
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});

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
      if (!response.ok) throw new Error("Failed to fetch appointments");
      const data = (await response.json()) as AppointmentsResponse;
      setAppointments(data.appointments || []);
    } catch (error) {
      console.error("Error fetching appointments", error);
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const response = await fetch("/api/admin/appointments/requests");
      if (!response.ok) throw new Error("Failed to fetch requests");
      const data = (await response.json()) as AppointmentRequestsResponse;
      const requests = data.requests || [];
      setRequestItems(requests);
      
      // Load notes
      const initialNotes: Record<string, string> = {};
      requests.forEach(req => {
        if (req.note) initialNotes[req.id] = req.note;
      });
      setRequestNotes(initialNotes);
    } catch (error) {
      console.error("Error fetching requests", error);
      setRequestItems([]);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAppointments();
    void fetchRequests();
  }, [fetchAppointments, fetchRequests]);

  // Deep linking for new bookings
  useEffect(() => {
    const action = searchParams.get("action");
    const customerIdParam = searchParams.get("customer_id");

    if (action === "new" && customerIdParam) {
      const customerId = Number(customerIdParam);
      if (!isNaN(customerId)) {
         // Fetch customer details logic would go here
         // For now simplified
         setDialogInitialCustomer({ id: customerId, name: `Customer #${customerId}` });
         setIsBookDialogOpen(true);
         setTab("schedule");
      }
    }
  }, [searchParams]);

  // Filter logic for History Tab
  const filteredHistory = appointments.filter((apt) => {
    if (historyStatusFilter !== "all" && apt.status !== historyStatusFilter) return false;
    
    if (historyTimeFilter !== "all") {
      const aptDate = parseISO(apt.appointment_datetime);
      if (historyTimeFilter === "upcoming" && !isFuture(aptDate)) return false;
      if (historyTimeFilter === "past" && !isPast(aptDate)) return false;
    }

    if (historySearchQuery) {
      const q = historySearchQuery.toLowerCase();
      const customerMatch = apt.customer?.name.toLowerCase().includes(q);
      const providerMatch = apt.provider?.toLowerCase().includes(q);
      const serviceMatch = apt.service_type.toLowerCase().includes(q);
      return customerMatch || providerMatch || serviceMatch;
    }

    return true;
  });

  const handleExport = () => {
    const exportData = filteredHistory.map((apt) => ({
      ID: apt.id,
      Customer: apt.customer?.name || "N/A",
      Date: format(parseISO(apt.appointment_datetime), "yyyy-MM-dd HH:mm"),
      Service: apt.service_type,
      Status: apt.status,
    }));
    exportToCSV(exportData, generateExportFilename("appointments"));
  };

  const handleDismissRequest = async (id: string) => {
    try {
        await fetch(`/api/admin/appointments/requests/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "dismissed" }),
        });
        await fetchRequests();
    } catch (e) { console.error(e); }
  };

  const handleSaveRequestNote = async (id: string, note: string) => {
    try {
        await fetch(`/api/admin/appointments/requests/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note }),
        });
        await fetchRequests();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-8 p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Appointments</h1>
          <p className="text-zinc-500 max-w-2xl">
            Manage your clinic's schedule, review incoming booking requests from Eva, and access historical records.
          </p>
        </div>
        <Button 
            onClick={() => {
                setDialogInitialCustomer(null);
                setIsBookDialogOpen(true);
            }} 
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
        >
          <Calendar className="mr-2 h-4 w-4" />
          New Booking
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="space-y-6">
          <TabsList className="bg-zinc-100/50 border border-zinc-200 p-1 rounded-xl w-full md:w-auto inline-flex h-11">
            <TabsTrigger 
              value="schedule" 
              className="relative rounded-lg data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary transition-all px-6"
            >
              {tab === "schedule" && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-zinc-200/50"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                />
              )}
              <span className="relative z-10">Schedule</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="requests" 
              className="relative rounded-lg data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary transition-all px-6"
            >
              {tab === "requests" && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-zinc-200/50"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                Requests
                {requestItems.filter(r => r.status === 'new').length > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm">
                      {requestItems.filter(r => r.status === 'new').length}
                  </span>
                )}
              </span>
            </TabsTrigger>

            <TabsTrigger 
              value="history" 
              className="relative rounded-lg data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary transition-all px-6"
            >
              {tab === "history" && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-zinc-200/50"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                />
              )}
              <span className="relative z-10">History</span>
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
              {tab === "schedule" && (
                <TabsContent value="schedule" className="outline-none" forceMount>
                     <ScheduleTab appointments={appointments} isLoading={isLoading} />
                </TabsContent>
              )}

              {tab === "requests" && (
                <TabsContent value="requests" className="outline-none" forceMount>
                     <RequestsTab
                        requests={requestItems}
                        isLoading={requestsLoading}
                        onBook={(req) => {
                            if (req.customer) {
                                setDialogInitialCustomer({
                                    id: req.customer.id,
                                    name: req.customer.name,
                                    phone: req.customer.phone || null
                                });
                                setIsBookDialogOpen(true);
                            }
                        }}
                        onDismiss={handleDismissRequest}
                        onStatusChange={() => {}} // Placeholder
                        onSaveNote={handleSaveRequestNote}
                        channelFilter={requestChannelFilter}
                        setChannelFilter={setRequestChannelFilter}
                        onRefresh={fetchRequests}
                     />
                </TabsContent>
              )}

              {tab === "history" && (
                <TabsContent value="history" className="outline-none" forceMount>
                     <HistoryTab 
                        appointments={filteredHistory} 
                        isLoading={isLoading}
                        onExport={handleExport}
                        searchQuery={historySearchQuery}
                        setSearchQuery={setHistorySearchQuery}
                        timeFilter={historyTimeFilter}
                        setTimeFilter={setHistoryFilter}
                        statusFilter={historyStatusFilter}
                        setStatusFilter={setHistoryStatusFilter}
                     />
                </TabsContent>
              )}
          </AnimatePresence>
      </Tabs>

      <BookAppointmentDialog
        open={isBookDialogOpen}
        onOpenChange={setIsBookDialogOpen}
        onSuccess={async () => {
            await fetchAppointments();
            await fetchRequests();
        }}
        initialCustomer={dialogInitialCustomer}
      />
    </div>
  );
}
