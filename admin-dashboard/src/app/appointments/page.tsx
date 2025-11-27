"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { BookAppointmentDialog } from "@/components/book-appointment-dialog";

// Modular Components
import { AppointmentCalendar } from "./components/AppointmentCalendar";
import { RequestsTab } from "./components/RequestsTab";
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

  // Requests Tab State
  const [requestItems, setRequestItems] = useState<AppointmentRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestChannelFilter, setRequestChannelFilter] = useState<"all" | "voice" | "sms" | "email" | "web">("all");
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});

  const [tab, setTab] = useState<"calendar" | "requests">("calendar");
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
    if (viewParam === "calendar" || viewParam === "requests") {
      setTab(viewParam as "calendar" | "requests");
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
      if (!response.ok) {
        const text = await response.text();
        console.error(
          "Failed to fetch appointment requests:",
          response.status,
          text,
        );
        setRequestItems([]);
        setRequestNotes({});
        return;
      }
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
      setRequestNotes({});
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
         setDialogInitialCustomer({ id: customerId, name: `Customer #${customerId}` });
         setIsBookDialogOpen(true);
         setTab("calendar");
      }
    }
  }, [searchParams]);

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
    <div className="space-y-6 p-6 max-w-[1800px] mx-auto h-screen flex flex-col overflow-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between flex-none">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Appointments</h1>
          <p className="text-sm text-zinc-500">
            Manage your schedule and booking requests.
          </p>
      </div>

        {/* Tabs Control */}
        <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="w-auto">
          <TabsList className="bg-zinc-100/80 p-1 rounded-lg inline-flex">
            <TabsTrigger 
              value="calendar" 
              className="px-4 py-1.5 text-sm rounded-md data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm transition-all"
            >
              Calendar
            </TabsTrigger>
            <TabsTrigger 
              value="requests" 
              className="px-4 py-1.5 text-sm rounded-md data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm transition-all flex items-center gap-2"
            >
                Requests
                {requestItems.filter(r => r.status === 'new').length > 0 && (
                  <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                      {requestItems.filter(r => r.status === 'new').length}
                  </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
              {tab === "calendar" && (
                <motion.div
                    key="calendar"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                >
                     <AppointmentCalendar 
                        appointments={appointments} 
                        isLoading={isLoading} 
                        onBookNew={() => {
                            setDialogInitialCustomer(null);
                            setIsBookDialogOpen(true);
                        }}
                     />
                </motion.div>
              )}

              {tab === "requests" && (
                <motion.div
                    key="requests"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                >
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
                        onStatusChange={() => {}} 
                        onSaveNote={handleSaveRequestNote}
                        channelFilter={requestChannelFilter}
                        setChannelFilter={setRequestChannelFilter}
                        onRefresh={fetchRequests}
                     />
                </motion.div>
              )}
          </AnimatePresence>
      </div>

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
