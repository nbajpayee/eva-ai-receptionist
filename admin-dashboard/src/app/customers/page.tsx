"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Search, User, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  created_at: string;
  conversation_count: number;
  booking_count: number;
};

type CustomersResponse = {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  customers: Customer[];
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          page_size: "20",
        });

        if (search) {
          params.set("search", search);
        }

        const response = await fetch(
          `/api/admin/customers?${params.toString()}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch customers");
        }

        const data: CustomersResponse = await response.json();
        setCustomers(data.customers);
        setTotalPages(data.total_pages);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(() => {
      fetchCustomers();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [search, page]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Customers</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {total} total customers
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1); // Reset to first page on search
              }}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-red-600">Error loading customers</p>
              <p className="mt-1 text-xs text-zinc-500">{error}</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center">
              <User className="mx-auto h-12 w-12 text-zinc-300" />
              <p className="mt-2 text-sm text-zinc-500">
                {search ? "No customers found" : "No customers yet"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {customers.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  className="block transition-colors hover:bg-zinc-50"
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100">
                      <User className="h-6 w-6 text-zinc-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-zinc-900 truncate">
                          {customer.name}
                        </h3>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm text-zinc-500">
                        <span>{customer.phone}</span>
                        {customer.email && (
                          <>
                            <span>•</span>
                            <span className="truncate">{customer.email}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-zinc-900">
                          {customer.conversation_count}
                        </div>
                        <div className="text-xs text-zinc-500">Conversations</div>
                      </div>

                      <div className="text-center">
                        <div className="font-semibold text-zinc-900">
                          {customer.booking_count}
                        </div>
                        <div className="text-xs text-zinc-500">Bookings</div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-zinc-500">
                          Joined {format(new Date(customer.created_at), "MMM d, yyyy")}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
