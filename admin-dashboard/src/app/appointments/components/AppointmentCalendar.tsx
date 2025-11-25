import { useState, useMemo } from "react";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, addWeeks, subWeeks, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, LayoutGrid, Clock, Filter, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Appointment } from "./types";
import { motion, AnimatePresence } from "framer-motion";
import { AppointmentCard } from "./AppointmentCard";

interface AppointmentCalendarProps {
  appointments: Appointment[];
  isLoading: boolean;
  onBookNew: () => void;
}

type ViewMode = "day" | "week" | "month" | "list";

export function AppointmentCalendar({ appointments, isLoading, onBookNew }: AppointmentCalendarProps) {
  const [view, setView] = useState<ViewMode>("week");
  const [date, setDate] = useState(new Date());
  
  // Filters
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Derived Data
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      if (providerFilter !== "all" && apt.provider !== providerFilter) return false;
      if (statusFilter !== "all" && apt.status !== statusFilter) return false;
      return true;
    });
  }, [appointments, providerFilter, statusFilter]);

  const displayedAppointments = useMemo(() => {
    switch (view) {
      case "day":
        return filteredAppointments.filter(a => isSameDay(new Date(a.appointment_datetime), date));
      case "week":
        const start = startOfWeek(date, { weekStartsOn: 1 });
        const end = endOfWeek(date, { weekStartsOn: 1 });
        return filteredAppointments.filter(a => 
          isWithinInterval(new Date(a.appointment_datetime), { start, end })
        );
      case "month":
        return filteredAppointments.filter(a => isSameMonth(new Date(a.appointment_datetime), date));
      case "list":
        // For list view, we might want to show everything or windowed. 
        // Let's show all for now, sorted by date desc (recent first)
        return [...filteredAppointments].sort((a, b) => 
          new Date(b.appointment_datetime).getTime() - new Date(a.appointment_datetime).getTime()
        );
      default:
        return filteredAppointments;
    }
  }, [view, date, filteredAppointments]);

  // Navigation Handlers
  const navigate = (direction: "prev" | "next") => {
    const modifier = direction === "prev" ? -1 : 1;
    switch (view) {
      case "day": setDate(addDays(date, modifier)); break;
      case "week": setDate(addWeeks(date, modifier)); break;
      case "month": setDate(addMonths(date, modifier)); break;
      case "list": break; // No navigation in list mode usually, or simple pagination
    }
  };

  const providers = Array.from(new Set(appointments.map(a => a.provider).filter(Boolean)));
  const statuses = ["scheduled", "completed", "cancelled", "no_show"];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 rounded-xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-100 rounded-lg p-1">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => navigate("prev")}
                    disabled={view === 'list'}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-3 text-sm font-semibold"
                    onClick={() => setDate(new Date())}
                >
                    Today
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => navigate("next")}
                    disabled={view === 'list'}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            
            <h2 className="text-lg font-semibold min-w-[200px] text-center sm:text-left ml-2">
                {view === 'day' && format(date, "EEEE, MMMM d, yyyy")}
                {view === 'week' && `Week of ${format(startOfWeek(date, { weekStartsOn: 1 }), "MMM d, yyyy")}`}
                {view === 'month' && format(date, "MMMM yyyy")}
                {view === 'list' && "All Appointments"}
            </h2>
        </div>

        <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex bg-zinc-100 p-1 rounded-lg">
                {(["day", "week", "month", "list"] as const).map((v) => (
                    <button
                        key={v}
                        onClick={() => setView(v)}
                        className={cn(
                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                            view === v 
                                ? "bg-white text-zinc-900 shadow-sm" 
                                : "text-zinc-500 hover:text-zinc-900"
                        )}
                    >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                ))}
            </div>

            <div className="h-4 w-px bg-zinc-200 mx-2" />

            {/* Filters */}
            <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="h-9 w-[150px] text-xs bg-white border-zinc-200">
                    <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {providers.map(p => <SelectItem key={p as string} value={p as string}>{p}</SelectItem>)}
                </SelectContent>
            </Select>

             <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[140px] text-xs bg-white border-zinc-200">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statuses.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                </SelectContent>
            </Select>
            
            <Button onClick={onBookNew} className="ml-2 bg-[#4BA3E3] hover:bg-[#3b8fd3] text-white h-9">
                + Book
            </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col relative">
         {view === "week" && <WeekView date={date} appointments={displayedAppointments} />}
         {view === "day" && <DayView date={date} appointments={displayedAppointments} />}
         {view === "month" && <MonthView date={date} appointments={displayedAppointments} setDate={setDate} setView={setView} />}
         {view === "list" && <ListView appointments={displayedAppointments} />}
      </div>
    </div>
  );
}

// --- Sub-Components (Internal for now, can be extracted) ---

function WeekView({ date, appointments }: { date: Date, appointments: Appointment[] }) {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
    const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 7 AM to 7 PM

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-8 border-b border-zinc-200 bg-zinc-50/50">
                <div className="p-2 border-r border-zinc-200 w-16 sticky left-0 bg-zinc-50 z-10"></div>
                {days.map(day => (
                    <div key={day.toISOString()} className={cn("p-2 text-center border-r border-zinc-100", isSameDay(day, new Date()) && "bg-blue-50/50")}>
                        <div className="text-xs font-medium text-zinc-500 uppercase">{format(day, "EEE")}</div>
                        <div className={cn("text-lg font-bold", isSameDay(day, new Date()) ? "text-[#4BA3E3]" : "text-zinc-900")}>
                            {format(day, "d")}
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-8 relative min-h-[600px]">
                    {/* Time Column */}
                    <div className="border-r border-zinc-200 bg-zinc-50 w-16 sticky left-0 z-10">
                        {hours.map(hour => (
                            <div key={hour} className="h-20 border-b border-zinc-100 text-[10px] text-zinc-400 p-1 text-right pr-2 relative">
                                <span className="-top-2 relative">{hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}</span>
                            </div>
                        ))}
                    </div>

                    {/* Day Columns */}
                    {days.map(day => {
                        const dayApts = appointments.filter(a => isSameDay(new Date(a.appointment_datetime), day));
                        return (
                            <div key={day.toISOString()} className={cn("border-r border-zinc-100 relative min-h-full", isSameDay(day, new Date()) && "bg-blue-50/10")}>
                                {hours.map(h => <div key={h} className="h-20 border-b border-zinc-100/50" />)}
                                
                                {/* Events */}
                                {dayApts.map(apt => {
                                    const aptDate = new Date(apt.appointment_datetime);
                                    const startHour = aptDate.getHours();
                                    const startMin = aptDate.getMinutes();
                                    
                                    // Calculate position relative to 7 AM start
                                    const topOffset = ((startHour - 7) * 80) + ((startMin / 60) * 80);
                                    const height = (apt.duration_minutes / 60) * 80;

                                    return (
                                        <div
                                            key={apt.id}
                                            className="absolute left-1 right-1 rounded-md p-2 text-xs border border-white/20 shadow-sm overflow-hidden hover:z-20 transition-all hover:scale-[1.02] cursor-pointer"
                                            style={{
                                                top: `${Math.max(0, topOffset)}px`,
                                                height: `${Math.max(30, height)}px`, // min height for visibility
                                                backgroundColor: getServiceColor(apt.service_type),
                                                color: 'white'
                                            }}
                                        >
                                            <div className="font-semibold truncate">{apt.service_type}</div>
                                            <div className="opacity-90 truncate">{apt.customer?.name}</div>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function DayView({ date, appointments }: { date: Date, appointments: Appointment[] }) {
    const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 7 AM to 7 PM

    return (
        <div className="flex flex-col h-full overflow-hidden">
             <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                <div className="relative max-w-3xl mx-auto border border-zinc-200 rounded-xl bg-white shadow-sm overflow-hidden">
                     {hours.map(hour => (
                        <div key={hour} className="grid grid-cols-[80px_1fr] border-b border-zinc-100 min-h-[100px]">
                            <div className="p-4 text-xs font-medium text-zinc-400 text-right bg-zinc-50 border-r border-zinc-100">
                                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                            </div>
                            <div className="relative">
                                {/* Events for this hour block */}
                                {appointments.filter(a => {
                                    const h = new Date(a.appointment_datetime).getHours();
                                    return h === hour;
                                }).map(apt => (
                                    <div key={apt.id} className="absolute left-2 right-2 top-1 bottom-1 rounded-lg bg-sky-100 border border-sky-200 p-3 text-sky-900">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold">{format(new Date(apt.appointment_datetime), "h:mm a")} - {apt.service_type}</span>
                                            <span className="text-sm bg-white/50 px-2 py-0.5 rounded-full">{apt.provider}</span>
                                        </div>
                                        <div className="mt-1 text-sm">{apt.customer?.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                     ))}
                </div>
             </div>
        </div>
    );
}

function MonthView({ date, appointments, setDate, setView }: any) {
    // Simplified wrapper around Calendar component
    return (
        <div className="p-8 flex justify-center h-full overflow-y-auto">
            <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                    if(d) {
                        setDate(d);
                        setView('day');
                    }
                }}
                className="rounded-md border shadow p-6 w-full max-w-2xl bg-white"
                components={{
                    DayContent: (props) => {
                         const dayApts = appointments.filter((a: Appointment) => isSameDay(new Date(a.appointment_datetime), props.date));
                         return (
                            <div className="w-full h-full min-h-[60px] flex flex-col items-start justify-start p-1 relative">
                                <span className="text-sm font-medium mb-1">{props.date.getDate()}</span>
                                <div className="flex flex-col gap-0.5 w-full">
                                    {dayApts.slice(0, 3).map((a: Appointment) => (
                                        <div key={a.id} className="h-1.5 w-full rounded-full bg-blue-500 opacity-50" title={a.service_type} />
                                    ))}
                                    {dayApts.length > 3 && <div className="h-1.5 w-1.5 rounded-full bg-zinc-300 self-center" />}
                                </div>
                            </div>
                         )
                    }
                }}
            />
        </div>
    )
}

function ListView({ appointments }: { appointments: Appointment[] }) {
    if (appointments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                <CalendarIcon className="h-12 w-12 mb-4 opacity-20" />
                <p>No appointments found.</p>
            </div>
        )
    }

    return (
        <div className="overflow-y-auto h-full p-4">
             <div className="max-w-4xl mx-auto space-y-3">
                 {appointments.map(apt => (
                     <AppointmentCard key={apt.id} appointment={apt} isUpcoming={new Date(apt.appointment_datetime) > new Date()} />
                 ))}
             </div>
        </div>
    )
}

function getServiceColor(type: string) {
    const colors: Record<string, string> = {
        'Consultation': '#4BA3E3', // Sky
        'Follow-up': '#8B5CF6', // Violet
        'Check-up': '#10B981', // Emerald
        'Cleaning': '#F59E0B', // Amber
    };
    return colors[type] || '#71717a'; // Zinc
}

