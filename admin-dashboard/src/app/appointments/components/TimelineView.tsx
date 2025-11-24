import { format, parseISO, isSameDay, setHours, setMinutes } from "date-fns";
import { motion } from "framer-motion";
import { Appointment } from "./types";

interface TimelineViewProps {
  appointments: Appointment[];
}

export function TimelineView({ appointments }: TimelineViewProps) {
  const startHour = 8; // 8 AM
  const endHour = 18; // 6 PM
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  // Simple layout logic to avoid overlaps would go here in a real app
  // For now, we just place them based on time
  
  return (
    <div className="relative rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col divide-y divide-zinc-100">
        {hours.map((hour) => (
          <div key={hour} className="flex h-20">
            <div className="w-16 shrink-0 border-r border-zinc-100 bg-zinc-50/50 py-2 pr-3 text-right text-xs font-medium text-zinc-500">
              {format(setHours(new Date(), hour), "h a")}
            </div>
            <div className="relative flex-1 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_14px]">
               {/* Render appointments for this hour slot if any start here? 
                   Ideally, we render them absolutely positioned over the whole grid.
               */}
            </div>
          </div>
        ))}

        {/* Overlay Appointments */}
        <div className="absolute inset-0 left-16 pointer-events-none">
            {appointments.map(apt => {
                const date = parseISO(apt.appointment_datetime);
                const hour = date.getHours();
                if (hour < startHour || hour > endHour) return null;
                
                const topOffset = (hour - startHour) * 80 + (date.getMinutes() / 60) * 80;
                const height = (apt.duration_minutes / 60) * 80;

                return (
                    <motion.div
                        key={apt.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute left-2 right-2 rounded-md border border-[#4BA3E3] bg-[#4BA3E3]/10 p-2 text-xs hover:z-10 hover:shadow-lg pointer-events-auto cursor-pointer transition-all"
                        style={{ top: topOffset, height: Math.max(height, 24) }}
                    >
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-[#4BA3E3]">{format(date, "h:mm")}</span>
                            <span className="font-semibold text-zinc-900 truncate">{apt.service_type}</span>
                        </div>
                        {height > 40 && (
                             <div className="text-zinc-600 truncate mt-0.5">
                                {apt.customer?.name}
                            </div>
                        )}
                    </motion.div>
                )
            })}
        </div>
      </div>
    </div>
  );
}

