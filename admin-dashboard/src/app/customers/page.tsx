"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Phone, Mail, AlertTriangle, Baby, Download, Search, X } from "lucide-react";
import { format } from "date-fns";
import { exportToCSV, generateExportFilename } from "@/lib/export-utils";
import { CreateCustomerModal } from "@/components/customers/create-customer-modal";
import { CustomerCardSkeletonList } from "@/components/skeletons/customer-card-skeleton";

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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [showAllergiesOnly, setShowAllergiesOnly] = useState(false);
  const [showPregnantOnly, setShowPregnantOnly] = useState(false);

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/admin/customers?page=1&page_size=50");

      if (!response.ok) {
        console.warn("Failed to fetch customers", response.statusText);
        return;
      }

      const data = (await response.json()) as CustomersResponse;
      setCustomers(data.customers || []);
    } catch (error) {
      console.error("Error fetching customers", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleCreateSuccess = () => {
    // Refresh customer list after successful creation
    fetchCustomers();
  };

  // Filter customers based on search and filters
  const filteredCustomers = customers.filter((customer) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = customer.name.toLowerCase().includes(query);
      const matchesPhone = customer.phone.toLowerCase().includes(query);
      const matchesEmail = customer.email?.toLowerCase().includes(query);
      if (!matchesName && !matchesPhone && !matchesEmail) {
        return false;
      }
    }

    // Medical/status filters
    if (showNewOnly && !customer.is_new_client) return false;
    if (showAllergiesOnly && !customer.has_allergies) return false;
    if (showPregnantOnly && !customer.is_pregnant) return false;

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

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-zinc-900">Customers</h1>
          <p className="text-sm text-zinc-500">
            Manage customer profiles, medical screening, and interaction history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={filteredCustomers.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Customer
          </Button>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search by name, phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">Filters:</span>
          <Button
            variant={showNewOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowNewOnly(!showNewOnly)}
          >
            New Clients
          </Button>
          <Button
            variant={showAllergiesOnly ? "destructive" : "outline"}
            size="sm"
            onClick={() => setShowAllergiesOnly(!showAllergiesOnly)}
          >
            <AlertTriangle className="mr-1 h-3 w-3" />
            Allergies
          </Button>
          <Button
            variant={showPregnantOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPregnantOnly(!showPregnantOnly)}
            className={showPregnantOnly ? "bg-pink-600 hover:bg-pink-700" : ""}
          >
            <Baby className="mr-1 h-3 w-3" />
            Pregnant
          </Button>
          {(searchQuery || showNewOnly || showAllergiesOnly || showPregnantOnly) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setShowNewOnly(false);
                setShowAllergiesOnly(false);
                setShowPregnantOnly(false);
              }}
            >
              Clear All
            </Button>
          )}
          <span className="ml-auto text-sm text-zinc-500">
            Showing {filteredCustomers.length} of {customers.length} customers
          </span>
        </div>
      </div>

      {isLoading && <CustomerCardSkeletonList count={5} />}

      {!isLoading && customers.length === 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-sm text-zinc-600">
            No customers found. Customers will appear here once they interact with Eva.
          </p>
        </div>
      )}

      {!isLoading && customers.length > 0 && filteredCustomers.length === 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-sm text-zinc-600">
            No customers match your search or filter criteria.
          </p>
        </div>
      )}

      {filteredCustomers.length > 0 && (
        <div className="grid gap-4">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold">
                      {customer.name}
                      {customer.is_new_client && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          New
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </span>
                      {customer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Link href={`/customers/${customer.id}`}>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  {/* Medical Flags */}
                  <div className="flex items-center gap-2">
                    {customer.has_allergies && (
                      <Badge
                        variant="outline"
                        className="text-xs border-red-200 bg-red-100 text-red-700"
                      >
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Allergies
                      </Badge>
                    )}
                    {customer.is_pregnant && (
                      <Badge variant="default" className="text-xs bg-pink-600">
                        <Baby className="mr-1 h-3 w-3" />
                        Pregnant
                      </Badge>
                    )}
                  </div>

                  {/* Activity Stats */}
                  <div className="ml-auto flex items-center gap-4 text-xs text-zinc-500">
                    {(customer.appointment_count ?? 0) > 0 && (
                      <span>{customer.appointment_count} appointment{customer.appointment_count !== 1 ? 's' : ''}</span>
                    )}
                    {(customer.call_count ?? 0) > 0 && (
                      <span>{customer.call_count} call{customer.call_count !== 1 ? 's' : ''}</span>
                    )}
                    {(customer.conversation_count ?? 0) > 0 && (
                      <span>{customer.conversation_count} message{customer.conversation_count !== 1 ? 's' : ''}</span>
                    )}
                    {customer.created_at && (
                      <span>
                        Added {format(new Date(customer.created_at), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateCustomerModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
