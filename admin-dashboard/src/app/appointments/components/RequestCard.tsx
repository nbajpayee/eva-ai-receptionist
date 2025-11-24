import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Calendar, Clock, User, MessageSquare, Phone, Mail, Globe, Check, X, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppointmentRequest } from "./types";
import { motion } from "framer-motion";

interface RequestCardProps {
  request: AppointmentRequest;
  onBook: (req: AppointmentRequest) => void;
  onDismiss: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onSaveNote: (id: string, note: string) => void;
}

const CHANNEL_ICONS = {
  voice: Phone,
  sms: MessageSquare,
  email: Mail,
  web: Globe,
};

export function RequestCard({ request, onBook, onDismiss }: RequestCardProps) {
  const ChannelIcon = CHANNEL_ICONS[request.channel as keyof typeof CHANNEL_ICONS] || MessageSquare;
  const createdDate = parseISO(request.created_at);

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="group relative overflow-hidden border-l-4 border-l-zinc-300 hover:border-l-[#4BA3E3] transition-all">
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 hover:bg-zinc-200 gap-1">
                <ChannelIcon className="h-3 w-3" />
                <span className="capitalize">{request.channel}</span>
              </Badge>
              <span className="text-[10px] font-medium text-zinc-400">
                {formatDistanceToNow(createdDate, { addSuffix: true })}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <h4 className="font-medium text-zinc-900">
              {request.customer?.name || "Unknown Customer"}
            </h4>
            <div className="text-xs text-zinc-500 flex flex-col gap-0.5">
               {request.service_type && <span>Interested in: <span className="font-medium text-zinc-700">{request.service_type}</span></span>}
               {request.requested_time_window && <span>Time: <span className="font-medium text-zinc-700">{request.requested_time_window}</span></span>}
            </div>
          </div>

          {request.note && (
            <div className="bg-yellow-50 p-2 rounded text-xs text-yellow-800 border border-yellow-100 italic">
              &quot;{request.note}&quot;
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button 
                onClick={() => onBook(request)} 
                size="sm" 
                className="flex-1 bg-zinc-900 text-white hover:bg-[#4BA3E3] transition-colors shadow-sm"
            >
              Book Now
            </Button>
            <Button 
                onClick={() => onDismiss(request.id)} 
                variant="outline" 
                size="icon"
                className="h-9 w-9 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

