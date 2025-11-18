"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Phone, Mail, AlertTriangle, Baby, Download } from "lucide-react";
import { format } from "date-fns";
import { exportToCSV, generateExportFilename } from "@/lib/export-utils";

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

function getAppOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

function resolveInternalUrl(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${getAppOrigin()}${basePath}${path}`;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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

    fetchCustomers();
  }, []);

  const handleExport = () => {
    const exportData = customers.map((customer) => ({
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
          <Button variant="outline" onClick={handleExport} disabled={customers.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Customer
          </Button>
        </div>
      </header>

      {isLoading && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-sm text-zinc-600">Loading customers...</p>
        </div>
      )}

      {!isLoading && customers.length === 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-sm text-zinc-600">
            No customers found. Customers will appear here once they interact with Ava.
          </p>
        </div>
      )}

      {customers.length > 0 && (
        <div className="grid gap-4">
          {customers.map((customer) => (
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
                      <Badge variant="destructive" className="text-xs">
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
    </div>
  );
}
