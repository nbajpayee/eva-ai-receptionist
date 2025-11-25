"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Service {
  id: number;
  name: string;
  slug: string;
  description: string;
  duration_minutes: number;
  price_min: number | null;
  price_max: number | null;
  price_display: string | null;
  prep_instructions: string | null;
  aftercare_instructions: string | null;
  category: string | null;
  is_active: boolean;
  display_order: number;
}

const CATEGORIES = ["injectables", "skincare", "body", "wellness", "other"];

export function ServicesSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Partial<Service> | null>(null);

  const fetchServices = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/services");
      if (!response.ok) throw new Error("Failed to fetch services");
      const data = await response.json();
      setServices(data);
    } catch (error) {
      console.error("Failed to fetch services", error);
      toast({
        title: "Error",
        description: "Failed to load services",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleEditService = (service: Service | null = null) => {
    if (service) {
      setEditingService(service);
    } else {
      setEditingService({
        name: "",
        description: "",
        duration_minutes: 60,
        price_display: "",
        prep_instructions: "",
        aftercare_instructions: "",
        category: "other",
        is_active: true,
      });
    }
    setIsEditDialogOpen(true);
  };

  const handleSaveService = async () => {
    if (!editingService) return;

    try {
      const url = editingService.id
        ? `/api/admin/services/${editingService.id}`
        : "/api/admin/services";

      const method = editingService.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingService),
      });

      if (!response.ok) throw new Error("Failed to save service");

      toast({
        title: "Success",
        description: `Service ${editingService.id ? "updated" : "created"} successfully`,
      });

      setIsEditDialogOpen(false);
      fetchServices();
    } catch (error) {
      console.error("Failed to save service", error);
      toast({
        title: "Error",
        description: "Failed to save service",
        variant: "destructive",
      });
    }
  };

  const handleDeleteService = async (id: number) => {
    if (!confirm("Are you sure you want to delete this service?")) return;

    try {
      const response = await fetch(`/api/admin/services/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete service");

      toast({
        title: "Success",
        description: "Service deleted successfully",
      });

      fetchServices();
    } catch (error) {
      console.error("Failed to delete service", error);
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Services</CardTitle>
              <CardDescription>
                Manage services offered at your med spa
              </CardDescription>
            </div>
            <Button 
              onClick={() => handleEditService()}
              className="bg-gradient-to-r from-sky-500 to-teal-500 text-white shadow-md hover:from-sky-600 hover:to-teal-600 transition-all duration-300"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Service
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell>
                    {service.category && (
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                        {service.category}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{service.duration_minutes} min</TableCell>
                  <TableCell>
                    {service.price_display ||
                      (service.price_min && service.price_max
                        ? `$${service.price_min} - $${service.price_max}`
                        : "Contact for pricing")}
                  </TableCell>
                  <TableCell>
                    <Badge className={service.is_active ? "bg-teal-500 hover:bg-teal-600" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}>
                      {service.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditService(service)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteService(service.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Service Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingService?.id ? "Edit Service" : "Add Service"}
            </DialogTitle>
            <DialogDescription>
              Configure service details, pricing, and instructions
            </DialogDescription>
          </DialogHeader>
          {editingService && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Service Name</Label>
                  <Input
                    id="name"
                    value={editingService.name || ""}
                    onChange={(e) =>
                      setEditingService({ ...editingService, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={editingService.category || "other"}
                    onValueChange={(value: string) =>
                      setEditingService({ ...editingService, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editingService.description || ""}
                  onChange={(e) =>
                    setEditingService({ ...editingService, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={editingService.duration_minutes || 60}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        duration_minutes: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price_min">Min Price ($)</Label>
                  <Input
                    id="price_min"
                    type="number"
                    step="0.01"
                    value={editingService.price_min || ""}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        price_min: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price_max">Max Price ($)</Label>
                  <Input
                    id="price_max"
                    type="number"
                    step="0.01"
                    value={editingService.price_max || ""}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        price_max: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price_display">Price Display Text (optional)</Label>
                <Input
                  id="price_display"
                  value={editingService.price_display || ""}
                  onChange={(e) =>
                    setEditingService({ ...editingService, price_display: e.target.value })
                  }
                  placeholder="e.g., $300-$600 per session"
                />
                <p className="text-xs text-muted-foreground">
                  If specified, this text will be shown instead of the min/max range
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prep">Preparation Instructions</Label>
                <Textarea
                  id="prep"
                  value={editingService.prep_instructions || ""}
                  onChange={(e) =>
                    setEditingService({
                      ...editingService,
                      prep_instructions: e.target.value,
                    })
                  }
                  rows={3}
                  placeholder="What should clients do before the treatment?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aftercare">Aftercare Instructions</Label>
                <Textarea
                  id="aftercare"
                  value={editingService.aftercare_instructions || ""}
                  onChange={(e) =>
                    setEditingService({
                      ...editingService,
                      aftercare_instructions: e.target.value,
                    })
                  }
                  rows={3}
                  placeholder="What should clients do after the treatment?"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={editingService.is_active ?? true}
                  onCheckedChange={(checked: boolean) =>
                    setEditingService({ ...editingService, is_active: checked })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveService}>Save Service</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
