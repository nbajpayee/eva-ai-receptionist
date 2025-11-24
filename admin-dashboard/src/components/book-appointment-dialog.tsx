"use client";

import { useState, useEffect, useRef } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, User, Sparkles, Search, Phone, Mail, Check, X, Calendar as CalendarIcon } from "lucide-react";
import { format, addDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
  const [customerSearchResults, setCustomerSearchResults] = useState<CustomerSearchResult[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    service_type: "",
    appointment_datetime: "",
    provider: "__none__",
    special_requests: "",
  });

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string>("10:00");

  useEffect(() => {
    if (date && time) {
       const [hours, minutes] = time.split(':').map(Number);
       const newDate = new Date(date);
       newDate.setHours(hours, minutes);
       setFormData(prev => ({ ...prev, appointment_datetime: newDate.toISOString() }));
    }
  }, [date, time]);

  useEffect(() => {
    if (!open) return;

    fetchConfig();

    const tomorrow = addDays(new Date(), 1);
    tomorrow.setHours(10, 0, 0, 0);
    setDate(tomorrow);
    setTime("10:00");
    setFormData((prev) => ({
      ...prev,
      appointment_datetime: format(tomorrow, "yyyy-MM-dd'T'HH:mm"),
    }));

    if (initialCustomer) {
      setSelectedCustomer(initialCustomer);
      setCustomerSearch(initialCustomer.name || `Customer #${initialCustomer.id}`);
      setCustomerSearchResults([initialCustomer]);
    } else {
      resetCustomerSelection();
    }
  }, [open, initialCustomer]);

  const resetCustomerSelection = () => {
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerSearchResults([]);
    setHighlightedIndex(null);
  };

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
      setHighlightedIndex(null);
      return;
    }

    setCustomerSearchLoading(true);
    try {
      const params = new URLSearchParams({ search: term, page: "1", page_size: "5" });
      const response = await fetch(`/api/admin/customers?${params.toString()}`);
      if (!response.ok) throw new Error("Search failed");
      const data = (await response.json()) as { customers: CustomerSearchResult[] };
      setCustomerSearchResults(data.customers || []);
    } catch (err) {
      console.error("Error searching customers:", err);
      setCustomerSearchResults([]);
    } finally {
      setCustomerSearchLoading(false);
    }
  };

  useEffect(() => {
    if (!open || selectedCustomer) return;
    const term = customerSearch.trim();
    if (!term) {
      setCustomerSearchResults([]);
      return;
    }
    const timeoutId = setTimeout(() => {
      void handleCustomerSearch();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [customerSearch, open, selectedCustomer]);

  const handleSelectCustomer = (customer: CustomerSearchResult) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name || `Customer #${customer.id}`);
    setError(null);
    setHighlightedIndex(null);
    setCustomerSearchResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (customerSearchResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        if (prev === null) return 0;
        const next = prev + 1;
        return next >= customerSearchResults.length ? customerSearchResults.length - 1 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        if (prev === null) return customerSearchResults.length - 1;
        const next = prev - 1;
        return next < 0 ? 0 : next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex !== null && customerSearchResults[highlightedIndex]) {
        handleSelectCustomer(customerSearchResults[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
       setCustomerSearchResults([]);
       setHighlightedIndex(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!selectedCustomer) throw new Error("Please select a customer before booking.");

      const appointmentDate = new Date(formData.appointment_datetime);
      const isoDatetime = appointmentDate.toISOString();
      const providerValue = formData.provider === "__none__" ? null : formData.provider;

      const response = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setFormData({
        service_type: "",
        appointment_datetime: "",
        provider: "__none__",
        special_requests: "",
      });
      resetCustomerSelection();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const selectedService = formData.service_type ? services[formData.service_type] : null;

  const timeOptions = Array.from({ length: 24 * 4 }).map((_, i) => {
      const hour = Math.floor(i / 4);
      const minute = (i % 4) * 15;
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border-zinc-200 shadow-2xl">
        {/* Compact Header */}
        <div className="bg-white p-5 border-b border-zinc-100">
           <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4BA3E3]/10">
                    <CalendarIcon className="h-3.5 w-3.5 text-[#4BA3E3]" />
                </div>
                New Appointment
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
                Schedule a new service for a customer.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Compact Body */}
        <div className="p-5 bg-zinc-50/30">
        {configLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin text-[#4BA3E3]" />
            <span className="text-xs">Loading...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Customer Section */}
            <div className="space-y-1.5 relative z-20">
              <Label htmlFor="customer_search" className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Customer</Label>
              <div className="relative group">
                 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#4BA3E3] transition-colors" />
                 <Input
                    ref={searchInputRef}
                    id="customer_search"
                    placeholder="Search by name..."
                    value={customerSearch}
                    onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        if (selectedCustomer) setSelectedCustomer(null);
                    }}
                    onKeyDown={handleKeyDown}
                    className={cn(
                        "pl-9 pr-8 transition-all h-10 bg-white",
                        selectedCustomer 
                            ? "border-[#4BA3E3] bg-[#4BA3E3]/5 text-[#4BA3E3] font-medium focus-visible:ring-[#4BA3E3]" 
                            : "focus-visible:ring-[#4BA3E3]"
                    )}
                    autoComplete="off"
                />
                {customerSearchLoading ? (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 animate-spin" />
                ) : selectedCustomer ? (
                     <button 
                        type="button"
                        onClick={resetCustomerSelection}
                        className="absolute right-3 top-1/2 -translate-y-1/2 hover:bg-zinc-100 rounded-full p-0.5"
                     >
                        <X className="h-4 w-4 text-[#4BA3E3]" />
                     </button>
                ) : null}

                <AnimatePresence>
                    {customerSearchResults.length > 0 && !selectedCustomer && (
                        <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg ring-1 ring-black/5 z-50"
                        >
                            <div className="p-1">
                                {customerSearchResults.map((customer, index) => (
                                    <div
                                        key={customer.id}
                                        onClick={() => handleSelectCustomer(customer)}
                                        className={cn(
                                            "flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-colors",
                                            highlightedIndex === index ? "bg-zinc-100" : "hover:bg-zinc-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                                                <User className="h-3.5 w-3.5" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm text-zinc-900">{customer.name}</div>
                                                {customer.phone && <div className="text-xs text-zinc-500">{customer.phone}</div>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
              </div>
            </div>

            {/* Service & Date Row */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="service_type" className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Service</Label>
                    <Select
                        value={formData.service_type}
                        onValueChange={(value) => setFormData({ ...formData, service_type: value })}
                    >
                        <SelectTrigger id="service_type" className="bg-white focus:ring-[#4BA3E3] h-10">
                            {selectedService ? (
                                <span className="text-sm font-medium text-zinc-900 truncate">
                                    {selectedService.name} <span className="text-zinc-400 font-normal ml-1">• {selectedService.duration_minutes}m</span>
                                </span>
                            ) : (
                                <span className="text-zinc-500">Select Service</span>
                            )}
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(services).map(([key, service]) => (
                                <SelectItem key={key} value={key}>
                                    <div className="font-medium">{service.name}</div>
                                    <div className="text-xs text-zinc-500">{service.duration_minutes} min • {service.price_range}</div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Date & Time</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full h-10 justify-start text-left font-normal bg-white border-zinc-200 hover:bg-white focus:ring-2 focus:ring-[#4BA3E3] focus:border-[#4BA3E3]",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4 text-zinc-400" />
                                {date ? (
                                    <span className="text-sm font-medium text-zinc-900">
                                        {format(date, "PPP")} at {time}
                                    </span>
                                ) : (
                                    <span>Pick a date</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <div className="flex">
                                <div className="p-3 border-r border-zinc-100">
                                     <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        initialFocus
                                        className="p-0 pointer-events-auto"
                                    />
                                </div>
                                <div className="p-3 w-[160px] max-h-[300px] overflow-y-auto flex-shrink-0">
                                     <div className="text-xs font-medium text-zinc-500 mb-2 px-2">Time</div>
                                     <div className="grid gap-1">
                                        {timeOptions.map((t) => (
                                            <Button
                                                key={t}
                                                variant={time === t ? "default" : "ghost"}
                                                size="sm"
                                                className={cn(
                                                    "w-full justify-start text-xs font-normal h-8",
                                                    time === t ? "bg-[#4BA3E3] hover:bg-[#4BA3E3]/90 text-white" : "hover:bg-zinc-100 text-zinc-700"
                                                )}
                                                onClick={() => setTime(t)}
                                            >
                                                {t}
                                            </Button>
                                        ))}
                                     </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Provider Row */}
            <div className="space-y-1.5">
                <Label htmlFor="provider" className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Provider (Optional)</Label>
                <Select
                    value={formData.provider}
                    onValueChange={(value) => setFormData({ ...formData, provider: value })}
                >
                    <SelectTrigger id="provider" className="bg-white focus:ring-[#4BA3E3] h-10">
                        <SelectValue placeholder="Any Available Provider" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__none__">Any Available Provider</SelectItem>
                        {Object.entries(providers).map(([key, provider]) => (
                            <SelectItem key={key} value={provider.name}>
                                {provider.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Notes Area */}
            <div className="space-y-1.5">
                <Label htmlFor="special_requests" className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Special Requests</Label>
                <Textarea
                    id="special_requests"
                    value={formData.special_requests}
                    onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                    placeholder="Add any internal notes..."
                    className="min-h-[60px] resize-none focus-visible:ring-[#4BA3E3] bg-white text-sm"
                />
            </div>

            {/* Compact Info Card */}
            <AnimatePresence>
                {selectedService && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                         <div className="rounded-lg border border-[#4BA3E3]/20 bg-[#4BA3E3]/5 p-3 flex gap-3">
                            <Sparkles className="h-4 w-4 text-[#4BA3E3] shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <div className="text-xs font-semibold text-[#4BA3E3]">Service Details</div>
                                <p className="text-xs text-zinc-600 leading-relaxed">{selectedService.description}</p>
                                {selectedService.prep_instructions && (
                                    <div className="mt-1.5 pt-1.5 border-t border-[#4BA3E3]/10">
                                        <p className="text-[10px] font-bold text-[#4BA3E3] uppercase">Prep:</p>
                                        <p className="text-xs text-zinc-600">{selectedService.prep_instructions}</p>
                                    </div>
                                )}
                            </div>
                         </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                {error}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="h-9 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading || !formData.service_type || !selectedCustomer}
                className="h-9 bg-[#4BA3E3] hover:bg-[#4BA3E3]/90 text-white shadow-md shadow-[#4BA3E3]/20"
              >
                {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Confirm Booking
              </Button>
            </DialogFooter>
          </form>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
