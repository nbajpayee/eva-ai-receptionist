import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Calendar as CalendarIcon, List, LayoutGrid, Clock, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppointmentCard } from "./AppointmentCard";
import { TimelineView } from "./TimelineView";
import { Appointment } from "./types";
import { containerVariants } from "./animations";
import { AppointmentCardSkeletonList } from "@/components/skeletons/appointment-card-skeleton";

interface ScheduleTabProps {
  appointments: Appointment[];
  isLoading: boolean;
}

export function ScheduleTab({ appointments, isLoading }: ScheduleTabProps) {
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");
  const [timeFilter, setTimeFilter] = useState("today");

  if (isLoading) return <AppointmentCardSkeletonList count={3} />;

  const nextUpAppointment = appointments.find(a => a.status === 'scheduled'); // Simplification

  return (
    <div className="space-y-6">
      {/* Hero Section - "Next Up" */}
      {nextUpAppointment && (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 to-[#4BA3E3] p-6 text-white shadow-xl"
        >
            <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-[#4BA3E3]/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            
            <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#4BA3E3]-100">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium text-sky-100">Up Next • {format(new Date(nextUpAppointment.appointment_datetime), "h:mm a")}</span>
                    </div>
                    <h2 className="text-2xl font-bold leading-tight">
                        {nextUpAppointment.service_type}
                    </h2>
                    <p className="text-sky-100/80">
                         with {nextUpAppointment.customer?.name}
                    </p>
                </div>
                
                <div className="flex items-center gap-4 rounded-xl bg-white/10 p-4 backdrop-blur-md border border-white/20">
                    <div className="text-center">
                        <div className="text-xs text-white/60 uppercase tracking-wider">Duration</div>
                        <div className="text-lg font-bold">{nextUpAppointment.duration_minutes}m</div>
                    </div>
                    <div className="h-8 w-px bg-white/20" />
                    <div className="text-center">
                        <div className="text-xs text-white/60 uppercase tracking-wider">Provider</div>
                        <div className="text-lg font-bold">{nextUpAppointment.provider?.split(' ')[0]}</div>
                    </div>
                </div>
            </div>
        </motion.div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between sticky top-0 z-20 bg-zinc-50/95 backdrop-blur py-2">
         <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-zinc-900">Schedule</h3>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="h-8 w-[140px] bg-white text-xs">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="tomorrow">Tomorrow</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                </SelectContent>
            </Select>
         </div>

         <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-1">
            <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => setViewMode("list")}
            >
                <List className="mr-2 h-3.5 w-3.5" />
                List
            </Button>
            <Button
                variant={viewMode === "timeline" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => setViewMode("timeline")}
            >
                <LayoutGrid className="mr-2 h-3.5 w-3.5" />
                Timeline
            </Button>
         </div>
      </div>

      {/* Content */}
      {viewMode === "list" ? (
        <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid gap-4"
        >
            {appointments.map((apt) => (
                <AppointmentCard 
                    key={apt.id} 
                    appointment={apt} 
                    isUpcoming={new Date(apt.appointment_datetime) > new Date()} 
                />
            ))}
             {appointments.length === 0 && (
                <div className="py-12 text-center text-zinc-500">
                    No appointments scheduled for this time period.
                </div>
            )}
        </motion.div>
      ) : (
        <TimelineView appointments={appointments} />
      )}
    </div>
  );
}

