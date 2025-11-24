import { AppointmentRequest } from "./types";
import { RequestCard } from "./RequestCard";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KanbanBoardProps {
  requests: AppointmentRequest[];
  onBook: (req: AppointmentRequest) => void;
  onDismiss: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onSaveNote: (id: string, note: string) => void;
}

const COLUMNS = [
  { id: "new", label: "New Requests", color: "bg-[#4BA3E3]" },
  { id: "in_progress", label: "In Progress", color: "bg-amber-500" },
  { id: "follow_up", label: "Needs Follow-up", color: "bg-violet-500" },
];

export function KanbanBoard({ requests, onBook, onDismiss, onStatusChange, onSaveNote }: KanbanBoardProps) {
  
  const getColumnRequests = (status: string) => {
    // Simple mapping for demo - in real app match exact status strings
    if (status === "new") return requests.filter(r => r.status === "new" || !r.status);
    return requests.filter(r => r.status === status);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-[600px]">
      {COLUMNS.map((col) => (
        <div key={col.id} className="flex flex-col h-full rounded-xl bg-zinc-50/50 border border-zinc-200/60">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-zinc-50/95 backdrop-blur z-10 rounded-t-xl">
             <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${col.color}`} />
                <h3 className="font-semibold text-sm text-zinc-700">{col.label}</h3>
             </div>
             <span className="text-xs font-medium text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                {getColumnRequests(col.id).length}
             </span>
          </div>
          
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-3 min-h-[200px]">
                <AnimatePresence mode="popLayout">
                    {getColumnRequests(col.id).map(req => (
                        <RequestCard
                            key={req.id}
                            request={req}
                            onBook={onBook}
                            onDismiss={onDismiss}
                            onStatusChange={onStatusChange}
                            onSaveNote={onSaveNote}
                        />
                    ))}
                </AnimatePresence>
                {getColumnRequests(col.id).length === 0 && (
                    <div className="h-32 flex items-center justify-center text-xs text-zinc-400 border-2 border-dashed border-zinc-100 rounded-lg">
                        No requests
                    </div>
                )}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}

