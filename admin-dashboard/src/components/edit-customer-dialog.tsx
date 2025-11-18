"use client";

import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

type CustomerData = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  is_new_client: boolean;
  has_allergies: boolean;
  is_pregnant: boolean;
  notes: string | null;
};

interface EditCustomerDialogProps {
  customer: CustomerData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditCustomerDialog({
  customer,
  open,
  onOpenChange,
  onSuccess,
}: EditCustomerDialogProps) {
  const [formData, setFormData] = useState({
    name: customer.name,
    phone: customer.phone,
    email: customer.email || "",
    is_new_client: customer.is_new_client,
    has_allergies: customer.has_allergies,
    is_pregnant: customer.is_pregnant,
    notes: customer.notes || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          is_new_client: formData.is_new_client,
          has_allergies: formData.has_allergies,
          is_pregnant: formData.is_pregnant,
          notes: formData.notes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to update customer");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Customer Profile</DialogTitle>
          <DialogDescription>
            Update customer information and medical screening details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-zinc-900">Personal Information</h3>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Client Status */}
          <div className="space-y-4">
            <h3 className="font-medium text-zinc-900">Client Status</h3>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_new_client"
                checked={formData.is_new_client}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    is_new_client: checked === true,
                  })
                }
              />
              <Label htmlFor="is_new_client" className="font-normal">
                New Client (first time visitor)
              </Label>
            </div>
          </div>

          {/* Medical Screening */}
          <div className="space-y-4">
            <h3 className="font-medium text-zinc-900">Medical Screening</h3>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has_allergies"
                  checked={formData.has_allergies}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      has_allergies: checked === true,
                    })
                  }
                />
                <Label htmlFor="has_allergies" className="font-normal">
                  Has known allergies
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_pregnant"
                  checked={formData.is_pregnant}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      is_pregnant: checked === true,
                    })
                  }
                />
                <Label htmlFor="is_pregnant" className="font-normal">
                  Currently pregnant
                </Label>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Add any special notes, preferences, or important information..."
              rows={4}
            />
          </div>

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
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
