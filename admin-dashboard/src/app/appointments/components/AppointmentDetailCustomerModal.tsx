"use client";

import { useEffect, useState } from "react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  Mail,
  MessageSquare,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Appointment, Customer } from "./types";

type AppointmentStatus = Appointment["status"];

interface AppointmentDetailResponse {
  id: number;
  customer?: Customer | null;
  calendar_event_id?: string | null;
  appointment_datetime: string | null;
  service_type: string;
  provider?: string | null;
  duration_minutes: number;
  status: AppointmentStatus;
  booked_by: string;
  special_requests?: string | null;
  cancellation_reason?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { color: string; bg: string; border: string; label: string }
> = {
  scheduled: {
    color: "text-[#4BA3E3]",
    bg: "bg-[#4BA3E3]/10",
    border: "border-[#4BA3E3]/20",
    label: "Scheduled",
  },
  completed: {
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    label: "Completed",
  },
  cancelled: {
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    label: "Cancelled",
  },
  no_show: {
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    label: "No Show",
  },
  rescheduled: {
    color: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
    label: "Rescheduled",
  },
};

interface AppointmentDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentSummary: Appointment | null;
}

export function AppointmentDetailModal({
  open,
  onOpenChange,
  appointmentSummary,
}: AppointmentDetailModalProps) {
  const [detail, setDetail] = useState<AppointmentDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const summaryId = appointmentSummary?.id;

  useEffect(() => {
    if (!open || !summaryId) {
      return;
    }

    let cancelled = false;

    async function fetchDetail() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(`/api/admin/appointments/${summaryId}`);

        if (!response.ok) {
          const text = await response.text();
          console.error("Failed to fetch appointment detail:", response.status, text);
          if (!cancelled) {
            setLoadError("Unable to load appointment details.");
          }
          return;
        }

        const data = (await response.json()) as AppointmentDetailResponse;
        if (!cancelled) {
          setDetail(data);
        }
      } catch (error) {
        console.error("Failed to fetch appointment detail:", error);
        if (!cancelled) {
          setLoadError("Unable to load appointment details.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [open, summaryId]);

  if (!appointmentSummary) {
    return null;
  }

  const effective: any = detail ?? appointmentSummary;

  const customerFromDetail = (detail?.customer ?? (effective.customer as Customer | undefined)) ?? null;
  const customerName = customerFromDetail?.name
    || effective.customer?.name
    || (effective.customer_id ? `Customer #${effective.customer_id}` : "Unknown customer");

  const rawDate = detail?.appointment_datetime ?? (effective.appointment_datetime as string | null);
  const aptDate = rawDate ? parseISO(rawDate) : null;

  const durationMinutes = detail?.duration_minutes ?? (effective.duration_minutes as number | undefined) ?? 0;
  const serviceType = detail?.service_type ?? (effective.service_type as string | undefined) ?? "";
  const provider = detail?.provider ?? (effective.provider as string | undefined) ?? "";
  const status = (detail?.status ?? (effective.status as AppointmentStatus)) as AppointmentStatus;
  const bookedBy = detail?.booked_by ?? (effective.booked_by as string | undefined) ?? "";
  const createdAt = detail?.created_at ?? (effective.created_at as string | null | undefined) ?? null;
  const specialRequests = detail?.special_requests ?? (effective.special_requests as string | null | undefined) ?? null;
  const cancellationReason = detail?.cancellation_reason ?? (effective.cancellation_reason as string | null | undefined) ?? null;
  const customerId = effective.customer_id as number | undefined;

  const statusStyle = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setDetail(null);
      setLoadError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden border border-zinc-200 shadow-2xl">
        {/* Header: customer name */}
        <div className="border-b border-zinc-100 bg-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4BA3E3]/10">
                  <User className="h-4 w-4 text-[#4BA3E3]" />
                </div>
                <div className="flex flex-col">
                  <DialogTitle className="text-base font-semibold leading-tight text-zinc-900">
                    {customerName}
                  </DialogTitle>
                  {aptDate && (
                    <DialogDescription className="mt-0.5 text-xs text-zinc-500">
                      {format(aptDate, "EEE, MMM d, yyyy")} | {format(aptDate, "h:mm a")} | {durationMinutes} mins
                    </DialogDescription>
                  )}
                  {loading && (
                    <span className="mt-1 text-[10px] uppercase tracking-wide text-zinc-400">
                      Loading details...
                    </span>
                  )}
                  {loadError && (
                    <span className="mt-1 text-[10px] text-rose-500">{loadError}</span>
                  )}
                </div>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap",
                  statusStyle.bg,
                  statusStyle.color,
                  statusStyle.border
                )}
              >
                {statusStyle.label}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="space-y-4 bg-zinc-50/40 px-5 py-4">
          {/* Meta grid: includes Service as a dedicated field */}
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <CalendarIcon className="h-3.5 w-3.5" />
                <span className="font-medium text-[11px] uppercase tracking-wide">Service</span>
              </div>
              <p className="text-sm font-medium text-zinc-900">{serviceType || "Not specified"}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-medium text-[11px] uppercase tracking-wide">When</span>
              </div>
              <p className="text-sm font-medium text-zinc-900">
                {aptDate ? (
                  <>
                    {format(aptDate, "EEE, MMM d, yyyy")} at {format(aptDate, "h:mm a")}
                  </>
                ) : (
                  "Not scheduled"
                )}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <User className="h-3.5 w-3.5" />
                <span className="font-medium text-[11px] uppercase tracking-wide">Provider</span>
              </div>
              <p className="text-sm text-zinc-900">
                {provider || "Any available provider"}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <CalendarIcon className="h-3.5 w-3.5" />
                <span className="font-medium text-[11px] uppercase tracking-wide">Booked By</span>
              </div>
              <p className="text-sm text-zinc-900">{bookedBy || "Unknown"}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-medium text-[11px] uppercase tracking-wide">Created</span>
              </div>
              <p className="text-sm text-zinc-900">
                {createdAt ? format(parseISO(createdAt), "MMM d, yyyy h:mm a") : "Unknown"}
              </p>
            </div>
          </div>

          {/* Notes / cancellation */}
          {(specialRequests || cancellationReason) && (
            <div className="space-y-2">
              {specialRequests && (
                <div className="rounded-lg border border-yellow-100 bg-yellow-50/80 px-3 py-2 text-xs text-yellow-900">
                  <span className="font-semibold">Special requests:</span> {specialRequests}
                </div>
              )}
              {cancellationReason && (
                <div className="rounded-lg border border-rose-100 bg-rose-50/80 px-3 py-2 text-xs text-rose-900">
                  <span className="font-semibold">Cancellation reason:</span> {cancellationReason}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex gap-1.5">
              {customerFromDetail?.phone && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-zinc-200 text-zinc-500 hover:border-[#4BA3E3] hover:bg-[#4BA3E3]/5 hover:text-[#4BA3E3]"
                >
                  <Phone className="h-3.5 w-3.5" />
                </Button>
              )}
              {customerFromDetail?.email && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-zinc-200 text-zinc-500 hover:border-[#4BA3E3] hover:bg-[#4BA3E3]/5 hover:text-[#4BA3E3]"
                >
                  <Mail className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-zinc-200 text-zinc-500 hover:border-[#4BA3E3] hover:bg-[#4BA3E3]/5 hover:text-[#4BA3E3]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
            </div>

            {customerId && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 px-3 text-xs font-medium text-[#4BA3E3] hover:bg-[#4BA3E3]/5 hover:text-[#4BA3E3]"
              >
                <a href={`/customers/${customerId}`}>
                  View customer profile
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
