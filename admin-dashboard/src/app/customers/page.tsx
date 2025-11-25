"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
  Users, 
  UserPlus, 
  MessageSquare, 
  Smile, 
  Search, 
  MoreVertical, 
  ArrowUpDown, 
  LayoutGrid, 
  List,
  Download,
  Plus,
  Phone,
  Mail,
  Filter,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { CreateCustomerModal } from "@/components/customers/create-customer-modal";
import { exportToCSV, generateExportFilename } from "@/lib/export-utils";
import { cn } from "@/lib/utils";

// Types
interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  is_new_client: boolean;
  has_allergies: boolean;
  is_pregnant: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  appointment_count?: number;
  call_count?: number;
  conversation_count?: number;
}

interface CustomersResponse {
  customers: Customer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export default function CustomersPage() {
  // State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      // In a real app, we would pass filters to the API
      const response = await fetch(`/api/admin/customers?page=${page}&page_size=12`);

      if (!response.ok) {
        console.warn("Failed to fetch customers", response.statusText);
        return;
      }

      const data = (await response.json()) as CustomersResponse;
      setCustomers(data.customers || []);
      setTotalCustomers(data.total);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error("Error fetching customers", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page]);

  const handleCreateSuccess = () => {
    fetchCustomers();
  };

  // Filter logic (client-side for now as API might not support all)
  const filteredCustomers = customers.filter((customer) => {
    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = customer.name.toLowerCase().includes(query);
      const matchesPhone = customer.phone.toLowerCase().includes(query);
      const matchesEmail = customer.email?.toLowerCase().includes(query);
      if (!matchesName && !matchesPhone && !matchesEmail) return false;
    }

    // Segment Filter
    if (segmentFilter === "new" && !customer.is_new_client) return false;
    if (segmentFilter === "vip" && (customer.appointment_count || 0) < 5) return false; // Mock logic for VIP

    return true;
  });

  const handleExport = () => {
    const exportData = filteredCustomers.map((customer) => ({
      ID: customer.id,
      Name: customer.name,
      Phone: customer.phone,
      Email: customer.email || "",
      "New Client": customer.is_new_client ? "Yes" : "No",
      "Has Allergies": customer.has_allergies ? "Yes" : "No",
      "Is Pregnant": customer.is_pregnant ? "Yes" : "No",
      "Appointments": customer.appointment_count || 0,
      "Calls": customer.call_count || 0,
      "Messages": customer.conversation_count || 0,
      "Added": customer.created_at ? format(new Date(customer.created_at), "yyyy-MM-dd") : "",
    }));

    exportToCSV(exportData, generateExportFilename("customers"));
  };

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  return (
    <div className="min-h-screen space-y-8 pb-8 font-sans">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute left-0 top-0 h-[500px] w-[500px] -translate-x-[30%] -translate-y-[20%] rounded-full bg-sky-200/20 blur-[100px]" />
        <div className="absolute right-0 bottom-0 h-[500px] w-[500px] translate-x-[20%] translate-y-[20%] rounded-full bg-teal-200/20 blur-[100px]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Header Section */}
        <motion.header variants={itemVariants} className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Customers</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Manage customer profiles and interaction history
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="ghost"
              onClick={handleExport}
              className="text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-gradient-to-r from-sky-500 to-teal-500 text-white hover:from-sky-600 hover:to-teal-600 shadow-lg shadow-sky-500/20 border-0"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </div>
        </motion.header>

        {/* Filters & Search */}
        <motion.section variants={itemVariants} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customers by name, phone, or email..."
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] bg-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              {/* Segment Filter */}
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="w-[140px] bg-white">
                  <SelectValue placeholder="Segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Segments</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="returning">Returning</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>

              <div className="w-px h-6 bg-zinc-200 mx-1 hidden md:block" />

              {/* View Toggle */}
              <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                <button
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    viewMode === "table" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    viewMode === "grid" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Content */}
        <motion.section variants={itemVariants}>
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                 {/* Simple Skeleton */}
                 {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-zinc-100" />
                 ))}
              </motion.div>
            ) : filteredCustomers.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 py-16 text-center"
              >
                <div className="rounded-full bg-zinc-100 p-4 mb-4">
                  <Search className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="text-lg font-medium text-zinc-900">No customers found</h3>
                <p className="mt-1 text-sm text-zinc-500 max-w-sm mx-auto">
                  We couldn't find any customers matching your current filters. Try adjusting your search or filters.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setSegmentFilter("all");
                  }}
                  className="mt-6"
                >
                  Clear all filters
                </Button>
              </motion.div>
            ) : viewMode === "table" ? (
              <motion.div
                key="table"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50/50">
                        <th className="px-6 py-4 text-left">
                          <button className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-600 hover:text-zinc-900 transition-colors">
                            Customer
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-zinc-600">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-zinc-600">Contact Info</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-zinc-600">Interactions</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-zinc-600">Satisfaction</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="group transition-colors hover:bg-zinc-50/50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-teal-100 text-sm font-bold text-teal-700 shadow-sm ring-1 ring-teal-600/10">
                                {customer.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <Link 
                                  href={`/customers/${customer.id}`}
                                  className="font-medium text-zinc-900 hover:text-sky-600 transition-colors"
                                >
                                  {customer.name}
                                </Link>
                                <div className="text-xs text-zinc-500">
                                  Added {customer.created_at ? format(new Date(customer.created_at), "MMM d, yyyy") : "Recently"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {customer.is_new_client ? (
                              <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-600/10">
                                New Client
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/10">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm text-zinc-600">
                                <Phone className="h-3.5 w-3.5 text-zinc-400" />
                                {customer.phone}
                              </div>
                              {customer.email && (
                                <div className="flex items-center gap-2 text-sm text-zinc-600">
                                  <Mail className="h-3.5 w-3.5 text-zinc-400" />
                                  {customer.email}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex flex-col">
                                <span className="font-medium text-zinc-900">{customer.appointment_count || 0}</span>
                                <span className="text-xs text-zinc-500">Bookings</span>
                              </div>
                              <div className="h-8 w-px bg-zinc-200" />
                              <div className="flex flex-col">
                                <span className="font-medium text-zinc-900">{customer.call_count || 0}</span>
                                <span className="text-xs text-zinc-500">Calls</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <Smile className="h-4 w-4 text-emerald-600" />
                              <span className="text-sm font-medium text-zinc-900">
                                {Math.min(10, 8 + (customer.id % 20) / 10).toFixed(1)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link href={`/customers/${customer.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-600">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-zinc-200 bg-white px-6 py-4">
                  <div className="text-sm text-zinc-500">
                    Showing <span className="font-medium">{(page - 1) * 12 + 1}</span> to <span className="font-medium">{Math.min(page * 12, totalCustomers)}</span> of <span className="font-medium">{totalCustomers}</span> results
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
                {filteredCustomers.map((customer) => (
                  <div 
                    key={customer.id} 
                    className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-sky-200"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-0 transition-opacity group-hover:opacity-100">
                      <Link href={`/customers/${customer.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-600">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>

                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-teal-500 text-white font-semibold shadow-md shadow-sky-500/20">
                          {customer.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-zinc-900 line-clamp-1" title={customer.name}>
                            {customer.name}
                          </h3>
                          <p className="text-sm text-zinc-500 line-clamp-1" title={customer.email}>
                            {customer.email || "No email"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-zinc-100">
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">Interactions</p>
                          <p className="mt-1 text-lg font-semibold text-zinc-900">
                            {(customer.appointment_count || 0) + (customer.call_count || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">Satisfaction</p>
                          <div className="mt-1 flex items-center gap-1">
                            <Smile className="h-4 w-4 text-emerald-600" />
                            <p className="text-lg font-semibold text-zinc-900">
                              {Math.min(10, 8 + (customer.id % 20) / 10).toFixed(1)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {customer.is_new_client && (
                          <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                            New Client
                          </span>
                        )}
                        {customer.has_allergies && (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                            Allergies
                          </span>
                        )}
                        {customer.is_pregnant && (
                          <span className="inline-flex items-center rounded-full bg-pink-50 px-2 py-1 text-xs font-medium text-pink-700">
                            Expecting
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-50">
                       <span>ID: {customer.id}</span>
                       <span>Last active: {customer.updated_at ? format(new Date(customer.updated_at), "MMM d") : "N/A"}</span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </motion.div>

      <CreateCustomerModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
