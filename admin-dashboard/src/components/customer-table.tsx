"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { ArrowRight, Mail, Phone, Search, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  is_new_client: boolean;
  has_allergies: boolean;
  is_pregnant: boolean;
  created_at: string | null;
  total_appointments: number;
  total_conversations: number;
  last_activity_at: string | null;
  avg_satisfaction_score: number | null;
  preferred_channel: "voice" | "sms" | "email";
};

const channelBadge: Record<Customer["preferred_channel"], { label: string; className: string }> = {
  voice: { label: "Voice", className: "bg-sky-50 text-sky-700 border-sky-200" },
  sms: { label: "SMS", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  email: { label: "Email", className: "bg-violet-50 text-violet-700 border-violet-200" },
};

function satisfactionColor(score: number | null): string {
  if (!score) return "text-zinc-400";
  if (score >= 8) return "text-emerald-600";
  if (score >= 5) return "text-amber-600";
  return "text-rose-600";
}

interface CustomerTableProps {
  customers: Customer[];
  onSearch?: (query: string) => void;
  searchQuery?: string;
  loading?: boolean;
}

export function CustomerTable({
  customers,
  onSearch,
  searchQuery = "",
  loading = false
}: CustomerTableProps) {
  return (
    <Card className="border-zinc-200">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Customer Directory</CardTitle>
          <p className="text-sm text-zinc-500">
            All customers and their engagement metrics
          </p>
        </div>
        {onSearch && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-zinc-500">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Users className="mb-3 h-12 w-12 text-zinc-300" />
            <p className="text-sm font-medium text-zinc-900">No customers found</p>
            <p className="text-sm text-zinc-500">
              {searchQuery ? "Try adjusting your search" : "Customer data will appear here"}
            </p>
          </div>
        ) : (
          <div className="relative w-full overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr className="text-left text-xs uppercase tracking-widest text-zinc-500">
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium">Last Activity</th>
                  <th className="px-6 py-3 font-medium">Interactions</th>
                  <th className="px-6 py-3 font-medium">Channel</th>
                  <th className="px-6 py-3 font-medium">Satisfaction</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="group transition-colors hover:bg-zinc-50"
                  >
                    {/* Customer Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-900">
                          {customer.name}
                        </span>
                        {customer.is_new_client && (
                          <Badge
                            variant="outline"
                            className="bg-sky-50 text-sky-700 border-sky-200"
                          >
                            New
                          </Badge>
                        )}
                        {(customer.has_allergies || customer.is_pregnant) && (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200"
                          >
                            Medical
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Contact Info */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-zinc-600">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{customer.phone}</span>
                        </div>
                        {customer.email && (
                          <div className="flex items-center gap-1.5 text-zinc-600">
                            <Mail className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[200px]">
                              {customer.email}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Last Activity */}
                    <td className="px-6 py-4 text-zinc-600">
                      {customer.last_activity_at
                        ? formatDistanceToNow(new Date(customer.last_activity_at), {
                            addSuffix: true,
                          })
                        : "Never"}
                    </td>

                    {/* Interactions */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5 text-zinc-600">
                        <span>{customer.total_conversations} conversations</span>
                        <span className="text-xs text-zinc-500">
                          {customer.total_appointments} appointments
                        </span>
                      </div>
                    </td>

                    {/* Preferred Channel */}
                    <td className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className={channelBadge[customer.preferred_channel].className}
                      >
                        {channelBadge[customer.preferred_channel].label}
                      </Badge>
                    </td>

                    {/* Satisfaction Score */}
                    <td className="px-6 py-4">
                      <span
                        className={`font-medium ${satisfactionColor(
                          customer.avg_satisfaction_score
                        )}`}
                      >
                        {customer.avg_satisfaction_score
                          ? `${customer.avg_satisfaction_score}/10`
                          : "—"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Link href={`/customers/${customer.id}`}>
                          View
                          <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
