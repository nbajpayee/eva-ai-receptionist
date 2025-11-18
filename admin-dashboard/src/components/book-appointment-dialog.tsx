"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Calendar } from "lucide-react";
import { format, addDays } from "date-fns";

type Service = {
  name: string;
  duration_minutes: number;
  price_range: string;
  description: string;
};

type Provider = {
  name: string;
  title: string;
  specialties: string[];
};

interface BookAppointmentDialogProps {
  customerId: number;
  customerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BookAppointmentDialog({
  customerId,
  customerName,
  open,
  onOpenChange,
  onSuccess,
}: BookAppointmentDialogProps) {
  const [services, setServices] = useState<Record<string, Service>>({});
  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    service_type: "",
    appointment_datetime: "",
    provider: "",
    special_requests: "",
  });

  useEffect(() => {
    if (open) {
      fetchConfig();
      // Set default date to tomorrow at 10am
      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(10, 0, 0, 0);
      setFormData((prev) => ({
        ...prev,
        appointment_datetime: format(tomorrow, "yyyy-MM-dd'T'HH:mm"),
      }));
    }
  }, [open]);

  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const [servicesRes, providersRes] = await Promise.all([
        fetch("/api/config/services"),
        fetch("/api/config/providers"),
      ]);

      if (servicesRes.ok) {
        const data = await servicesRes.json();
        setServices(data.services || {});
      }

      if (providersRes.ok) {
        const data = await providersRes.json();
        setProviders(data.providers || {});
      }
    } catch (err) {
      console.error("Error fetching config:", err);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Convert datetime to ISO format with timezone
      const appointmentDate = new Date(formData.appointment_datetime);
      const isoDatetime = appointmentDate.toISOString();

      const response = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customerId,
          service_type: formData.service_type,
          appointment_datetime: isoDatetime,
          provider: formData.provider || null,
          special_requests: formData.special_requests || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to create appointment");
      }

      onSuccess();
      onOpenChange(false);

      // Reset form
      setFormData({
        service_type: "",
        appointment_datetime: "",
        provider: "",
        special_requests: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const selectedService = formData.service_type ? services[formData.service_type] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Book Appointment</DialogTitle>
          <DialogDescription>
            Schedule a new appointment for {customerName}
          </DialogDescription>
        </DialogHeader>

        {configLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Service Selection */}
            <div className="space-y-2">
              <Label htmlFor="service_type">Service *</Label>
              <Select
                value={formData.service_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, service_type: value })
                }
                required
              >
                <SelectTrigger id="service_type">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(services).map(([key, service]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{service.name}</span>
                        <span className="text-xs text-zinc-500">
                          {service.duration_minutes} min • {service.price_range}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedService && (
                <p className="text-sm text-zinc-600">
                  {selectedService.description}
                </p>
              )}
            </div>

            {/* Date & Time */}
            <div className="space-y-2">
              <Label htmlFor="appointment_datetime">Date & Time *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  id="appointment_datetime"
                  type="datetime-local"
                  value={formData.appointment_datetime}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      appointment_datetime: e.target.value,
                    })
                  }
                  className="pl-10"
                  required
                />
              </div>
              {selectedService && (
                <p className="text-xs text-zinc-500">
                  Duration: {selectedService.duration_minutes} minutes
                </p>
              )}
            </div>

            {/* Provider Selection */}
            <div className="space-y-2">
              <Label htmlFor="provider">Provider (Optional)</Label>
              <Select
                value={formData.provider}
                onValueChange={(value) =>
                  setFormData({ ...formData, provider: value })
                }
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select a provider (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No preference</SelectItem>
                  {Object.entries(providers).map(([key, provider]) => (
                    <SelectItem key={key} value={provider.name}>
                      <div className="flex flex-col">
                        <span>{provider.name}</span>
                        <span className="text-xs text-zinc-500">
                          {provider.title}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Special Requests */}
            <div className="space-y-2">
              <Label htmlFor="special_requests">Special Requests (Optional)</Label>
              <Textarea
                id="special_requests"
                value={formData.special_requests}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    special_requests: e.target.value,
                  })
                }
                placeholder="Any special requests or notes for this appointment..."
                rows={3}
              />
            </div>

            {/* Prep Instructions */}
            {selectedService && selectedService.prep_instructions && (
              <div className="rounded-lg bg-sky-50 border border-sky-200 p-4">
                <p className="text-sm font-medium text-sky-900 mb-1">
                  Preparation Instructions:
                </p>
                <p className="text-sm text-sky-700">
                  {selectedService.prep_instructions}
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !formData.service_type}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Book Appointment
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
