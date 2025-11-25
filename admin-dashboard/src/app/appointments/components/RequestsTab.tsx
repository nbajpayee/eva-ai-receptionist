import { useState } from "react";
import { AppointmentRequest } from "./types";
import { KanbanBoard } from "./KanbanBoard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppointmentCardSkeletonList } from "@/components/skeletons/appointment-card-skeleton";
import { RefreshCcw, Filter } from "lucide-react";

interface RequestsTabProps {
  requests: AppointmentRequest[];
  isLoading: boolean;
  onBook: (req: AppointmentRequest) => void;
  onDismiss: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onSaveNote: (id: string, note: string) => void;
  channelFilter: string;
  setChannelFilter: (val: "all" | "voice" | "sms" | "email" | "web") => void;
  onRefresh: () => void;
}

export function RequestsTab({ 
    requests, 
    isLoading, 
    onBook, 
    onDismiss, 
    onStatusChange, 
    onSaveNote,
    channelFilter,
    setChannelFilter,
    onRefresh
}: RequestsTabProps) {

  const filteredRequests = requests.filter(r => channelFilter === 'all' || r.channel === channelFilter);

  if (isLoading) return <AppointmentCardSkeletonList count={3} />;

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-none">
         <div className="flex items-center gap-3">
             <h3 className="text-lg font-semibold text-zinc-900">Request Board</h3>
             <div className="h-4 w-px bg-zinc-200" />
             <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-zinc-400" />
                <Select value={channelFilter} onValueChange={(v: any) => setChannelFilter(v)}>
                    <SelectTrigger className="h-8 border-0 bg-transparent p-0 text-xs font-medium text-zinc-600 hover:text-zinc-900 focus:ring-0 shadow-none w-[100px]">
                        <SelectValue placeholder="Channel" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Channels</SelectItem>
                        <SelectItem value="voice">Voice</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="web">Web</SelectItem>
                    </SelectContent>
                </Select>
             </div>
         </div>
         <Button variant="ghost" size="sm" onClick={onRefresh} className="text-zinc-500 hover:text-zinc-900">
            <RefreshCcw className="mr-2 h-3.5 w-3.5" />
            Refresh
         </Button>
      </div>

      <KanbanBoard
        requests={filteredRequests}
        onBook={onBook}
        onDismiss={onDismiss}
        onStatusChange={onStatusChange}
        onSaveNote={onSaveNote}
      />
    </div>
  );
}

