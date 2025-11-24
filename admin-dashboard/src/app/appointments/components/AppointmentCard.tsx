import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Calendar, Clock, User, ChevronRight, Phone, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { Appointment } from "./types";
import { itemVariants } from "./animations";

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  scheduled: { color: "text-[#4BA3E3]", bg: "bg-[#4BA3E3]/10", border: "border-[#4BA3E3]/20", label: "Scheduled" },
  completed: { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", label: "Completed" },
  cancelled: { color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", label: "Cancelled" },
  no_show: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", label: "No Show" },
  rescheduled: { color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200", label: "Rescheduled" },
};

interface AppointmentCardProps {
  appointment: Appointment;
  isUpcoming: boolean;
}

export function AppointmentCard({ appointment, isUpcoming }: AppointmentCardProps) {
  const aptDate = parseISO(appointment.appointment_datetime);
  const statusStyle = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.scheduled;

  return (
    <motion.div variants={itemVariants} layout>
      <Card className="group relative overflow-hidden border border-zinc-200 bg-white transition-all hover:border-zinc-300 hover:shadow-md">
        <div className={`absolute left-0 top-0 h-full w-1 ${statusStyle.bg.replace('/10', '')}`} />
        
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: Time & Date */}
          <div className="flex min-w-[140px] flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-900">{format(aptDate, "h:mm")}</span>
              <span className="text-sm font-medium text-zinc-500">{format(aptDate, "a")}</span>
            </div>
            <span className="text-sm font-medium text-zinc-500">{format(aptDate, "EEE, MMM d")}</span>
            
            {isUpcoming && appointment.status === "scheduled" && (
               <Badge className="mt-2 w-fit bg-[#4BA3E3] border-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                Starts {formatDistanceToNow(aptDate, { addSuffix: true })}
              </Badge>
            )}
          </div>

          {/* Middle: Details */}
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-bold text-zinc-900 group-hover:text-[#4BA3E3] transition-colors">
                    {appointment.service_type}
                </h3>
                {appointment.customer && (
                  <div className="flex items-center gap-2 text-sm text-zinc-600">
                    <span className="font-medium">{appointment.customer.name}</span>
                    <span className="text-zinc-300">•</span>
                    <span className="font-mono text-xs text-zinc-500">{appointment.customer.phone}</span>
                  </div>
                )}
              </div>
              
              <Badge variant="outline" className={`${statusStyle.bg} ${statusStyle.color} ${statusStyle.border}`}>
                {statusStyle.label}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{appointment.duration_minutes} mins</span>
              </div>
              {appointment.provider && (
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  <span>{appointment.provider}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-zinc-400">Booked by:</span>
                <span>{appointment.booked_by}</span>
              </div>
            </div>

            {appointment.special_requests && (
              <div className="mt-1 rounded-md bg-yellow-50/50 px-3 py-2 text-xs text-yellow-800 border border-yellow-100">
                <span className="font-bold">Note:</span> {appointment.special_requests}
              </div>
            )}
             {appointment.cancellation_reason && (
              <div className="mt-1 rounded-md bg-rose-50/50 px-3 py-2 text-xs text-rose-800 border border-rose-100">
                <span className="font-bold">Reason:</span> {appointment.cancellation_reason}
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-end sm:justify-start">
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Link href={`/customers/${appointment.customer_id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100">
                            <User className="h-4 w-4" />
                        </Button>
                        </Link>
                    </TooltipTrigger>
                    <TooltipContent>View Profile</TooltipContent>
                </Tooltip>
             </TooltipProvider>
             
             <div className="flex gap-1">
                 {appointment.customer?.phone && (
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-[#4BA3E3] hover:bg-[#4BA3E3]/10">
                         <Phone className="h-3.5 w-3.5" />
                     </Button>
                 )}
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-[#4BA3E3] hover:bg-[#4BA3E3]/10">
                     <MessageSquare className="h-3.5 w-3.5" />
                 </Button>
             </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

