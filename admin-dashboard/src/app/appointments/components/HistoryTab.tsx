import { useState } from "react";
import { Appointment } from "./types";
import { AppointmentCard } from "./AppointmentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppointmentCardSkeletonList } from "@/components/skeletons/appointment-card-skeleton";
import { Search, Download, FilterX } from "lucide-react";
import { motion } from "framer-motion";
import { containerVariants } from "./animations";

interface HistoryTabProps {
  appointments: Appointment[];
  isLoading: boolean;
  onExport: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  timeFilter: string;
  setTimeFilter: (v: "all" | "upcoming" | "past") => void;
  statusFilter: string;
  setStatusFilter: (v: any) => void;
}

export function HistoryTab({
  appointments,
  isLoading,
  onExport,
  searchQuery,
  setSearchQuery,
  timeFilter,
  setTimeFilter,
  statusFilter,
  setStatusFilter
}: HistoryTabProps) {
  
  if (isLoading) return <AppointmentCardSkeletonList count={5} />;

  const stats = {
    total: appointments.length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    scheduled: appointments.filter(a => a.status === 'scheduled').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
         <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total</div>
            <div className="mt-1 text-2xl font-bold text-zinc-900">{stats.total}</div>
         </div>
         <div className="rounded-lg border border-[#4BA3E3]/20 bg-[#4BA3E3]/10 p-4 shadow-sm">
            <div className="text-xs font-medium text-[#4BA3E3] uppercase tracking-wider">Scheduled</div>
            <div className="mt-1 text-2xl font-bold text-[#4BA3E3]">{stats.scheduled}</div>
         </div>
         <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
            <div className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Completed</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{stats.completed}</div>
         </div>
         <div className="rounded-lg border border-rose-100 bg-rose-50 p-4 shadow-sm">
            <div className="text-xs font-medium text-rose-600 uppercase tracking-wider">Cancelled</div>
            <div className="mt-1 text-2xl font-bold text-rose-700">{stats.cancelled}</div>
         </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 sm:flex-row sm:items-center">
         <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input 
                placeholder="Search by customer, provider, or service..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white border-zinc-200 focus-visible:ring-[#4BA3E3]" 
            />
         </div>
         
         <div className="flex items-center gap-2">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-[130px] bg-white">
                    <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="past">Past</SelectItem>
                </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] bg-white">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
            </Select>

            {(statusFilter !== "all" || timeFilter !== "all" || searchQuery) && (
              <Button
                variant="ghost"
                size="icon"
                className="text-zinc-500 hover:text-rose-600"
                onClick={() => {
                  setStatusFilter("all");
                  setTimeFilter("all");
                  setSearchQuery("");
                }}
              >
                <FilterX className="h-4 w-4" />
              </Button>
            )}
         </div>

         <div className="h-6 w-px bg-zinc-200 hidden sm:block" />
         
         <Button variant="outline" onClick={onExport} className="bg-white hover:bg-zinc-50">
            <Download className="mr-2 h-4 w-4" />
            Export
         </Button>
      </div>

      {/* Results */}
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
             <div className="rounded-xl border border-dashed border-zinc-200 p-12 text-center">
                <p className="text-sm text-zinc-500">No appointments found matching your criteria.</p>
             </div>
        )}
      </motion.div>
    </div>
  );
}

