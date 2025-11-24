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
  prep_instructions?: string;
  aftercare?: string;
};

type Provider = {
  name: string;
  title: string;
  specialties: string[];
};

type CustomerSearchResult = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
};

interface BookAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialCustomer?: CustomerSearchResult | null;
}

export function BookAppointmentDialog({
  open,
  onOpenChange,
  onSuccess,
  initialCustomer = null,
}: BookAppointmentDialogProps) {
  const [services, setServices] = useState<Record<string, Service>>({});
  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<
    CustomerSearchResult[]
  >([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(
    null,
  );
  const [selectedCustomer, setSelectedCustomer] = useState<
    CustomerSearchResult | null
  >(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    service_type: "",
    appointment_datetime: "",
    provider: "__none__",
    special_requests: "",
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    fetchConfig();

    // Set default date to tomorrow at 10am
    const tomorrow = addDays(new Date(), 1);
    tomorrow.setHours(10, 0, 0, 0);
    setFormData((prev) => ({
      ...prev,
      appointment_datetime: format(tomorrow, "yyyy-MM-dd'T'HH:mm"),
    }));

    if (initialCustomer) {
      setSelectedCustomer(initialCustomer);
      setCustomerSearch(
        initialCustomer.name || `Customer #${initialCustomer.id}`,
      );
      setCustomerSearchResults([initialCustomer]);
    } else {
      setSelectedCustomer(null);
      setCustomerSearch("");
      setCustomerSearchResults([]);
    }
    setCustomerSearchError(null);
  }, [open, initialCustomer]);

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

  const handleCustomerSearch = async () => {
    const term = customerSearch.trim();
    if (!term) {
      setCustomerSearchResults(initialCustomer ? [initialCustomer] : []);
      setCustomerSearchError(null);
      setHighlightedIndex(null);
      return;
    }

    setCustomerSearchLoading(true);
    setCustomerSearchError(null);
    try {
      const params = new URLSearchParams({
        search: term,
        page: "1",
        page_size: "10",
      });
      const response = await fetch(`/api/admin/customers?${params.toString()}`);

      if (!response.ok) {
        setCustomerSearchResults([]);
        setCustomerSearchError("Unable to search customers right now.");
        setHighlightedIndex(null);
        return;
      }

      const data = (await response.json()) as {
        customers: CustomerSearchResult[];
      };
      setCustomerSearchResults(data.customers || []);
    } catch (err) {
      console.error("Error searching customers:", err);
      setCustomerSearchResults([]);
      setCustomerSearchError("Unable to search customers right now.");
      setHighlightedIndex(null);
    } finally {
      setCustomerSearchLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const term = customerSearch.trim();
    if (!term) {
      setCustomerSearchResults(initialCustomer ? [initialCustomer] : []);
      setCustomerSearchError(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      void handleCustomerSearch();
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [customerSearch, open, initialCustomer]);

  const handleSelectCustomer = (customer: CustomerSearchResult) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name || `Customer #${customer.id}`);
    setError(null);
    setHighlightedIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!selectedCustomer) {
        throw new Error("Please select a customer before booking.");
      }

      // Convert datetime to ISO format with timezone
      const appointmentDate = new Date(formData.appointment_datetime);
      const isoDatetime = appointmentDate.toISOString();

      const providerValue =
        formData.provider === "__none__" ? null : formData.provider;

      const response = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          service_type: formData.service_type,
          appointment_datetime: isoDatetime,
          provider: providerValue,
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
        provider: "__none__",
        special_requests: "",
      });
      setSelectedCustomer(initialCustomer ?? null);
      setCustomerSearch(
        initialCustomer?.name || (initialCustomer ? `Customer #${initialCustomer.id}` : ""),
      );
      setCustomerSearchResults(initialCustomer ? [initialCustomer] : []);
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
            {selectedCustomer
              ? `Schedule a new appointment for ${
                  selectedCustomer.name || `Customer #${selectedCustomer.id}`
                }`
              : "Search for a customer to start a new booking."}
          </DialogDescription>
        </DialogHeader>

        {configLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label htmlFor="customer_search">Customer *</Label>
              <p className="text-xs text-zinc-500">
                Search by name, phone, or email. Suggestions update as you type.
              </p>
              <div className="relative">
                <Input
                  id="customer_search"
                  placeholder="Start typing name, phone, or email..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      if (customerSearchResults.length === 0) {
                        return;
                      }
                      e.preventDefault();
                      setHighlightedIndex((prev) => {
                        if (prev === null) return 0;
                        const next = prev + 1;
                        return next >= customerSearchResults.length
                          ? customerSearchResults.length - 1
                          : next;
                      });
                    } else if (e.key === "ArrowUp") {
                      if (customerSearchResults.length === 0) {
                        return;
                      }
                      e.preventDefault();
                      setHighlightedIndex((prev) => {
                        if (prev === null) return customerSearchResults.length - 1;
                        const next = prev - 1;
                        return next < 0 ? 0 : next;
                      });
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (customerSearchResults.length > 0) {
                        const index =
                          highlightedIndex !== null
                            ? highlightedIndex
                            : 0;
                        handleSelectCustomer(customerSearchResults[index]);
                      } else {
                        void handleCustomerSearch();
                      }
                    }
                  }}
                />
                {customerSearchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 animate-spin" />
                )}
              </div>
              {customerSearchError && (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                  {customerSearchError}
                </div>
              )}

              <div className="max-h-48 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50">
                {customerSearchResults.length === 0 && !customerSearchLoading ? (
                  <div className="p-3 text-xs text-zinc-500">
                    {customerSearch.trim()
                      ? "No customers match that search."
                      : "Start typing to search customers."}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-zinc-200">
                      {customerSearchResults.map((customer, index) => {
                        const isSelected =
                          selectedCustomer && selectedCustomer.id === customer.id;
                        const isHighlighted =
                          highlightedIndex !== null && highlightedIndex === index;
                        return (
                          <tr
                            key={customer.id}
                            className={
                              isHighlighted
                                ? "bg-zinc-100 cursor-pointer"
                                : isSelected
                                ? "bg-white cursor-pointer"
                                : "hover:bg-white cursor-pointer"
                            }
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <td className="p-3 align-middle">
                              <div className="flex flex-col">
                                <span className="font-medium text-zinc-900">
                                  {customer.name || `Customer #${customer.id}`}
                                </span>
                                {customer.phone && (
                                  <span className="text-xs text-zinc-500">
                                    {customer.phone}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {selectedCustomer && (
                <p className="text-xs text-zinc-600">
                  Selected: <span className="font-medium">
                    {selectedCustomer.name || `Customer #${selectedCustomer.id}`}
                  </span>
                  {selectedCustomer.phone && (
                    <span className="text-xs text-zinc-500">{` • ${selectedCustomer.phone}`}</span>
                  )}
                </p>
              )}
            </div>

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
                  <SelectItem value="__none__">No preference</SelectItem>
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
              <Button
                type="submit"
                disabled={loading || !formData.service_type || !selectedCustomer}
              >
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
