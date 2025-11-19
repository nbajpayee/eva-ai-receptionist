"use client";

import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Provider {
  id: string;  // UUID string
  name: string;
  email: string;
  phone: string | null;
  specialties: string[] | null;
  bio: string | null;
  is_active: boolean;
  hire_date: string | null;
  avatar_url: string | null;
}

export function ProvidersSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Partial<Provider> | null>(null);
  const [newSpecialty, setNewSpecialty] = useState("");

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await fetch("/api/admin/providers");
      if (!response.ok) throw new Error("Failed to fetch providers");
      const data = await response.json();
      setProviders(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load providers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditProvider = (provider: Provider | null = null) => {
    if (provider) {
      setEditingProvider(provider);
    } else {
      setEditingProvider({
        name: "",
        email: "",
        phone: "",
        specialties: [],
        bio: "",
        is_active: true,
      });
    }
    setNewSpecialty("");
    setIsEditDialogOpen(true);
  };

  const handleSaveProvider = async () => {
    if (!editingProvider) return;

    try {
      const url = editingProvider.id
        ? `/api/admin/providers/${editingProvider.id}`
        : "/api/admin/providers";

      const method = editingProvider.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProvider),
      });

      if (!response.ok) throw new Error("Failed to save provider");

      toast({
        title: "Success",
        description: `Provider ${editingProvider.id ? "updated" : "created"} successfully`,
      });

      setIsEditDialogOpen(false);
      fetchProviders();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save provider",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm("Are you sure you want to delete this provider?")) return;

    try {
      const response = await fetch(`/api/admin/providers/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete provider");

      toast({
        title: "Success",
        description: "Provider deleted successfully",
      });

      fetchProviders();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete provider",
        variant: "destructive",
      });
    }
  };

  const handleAddSpecialty = () => {
    if (!newSpecialty.trim() || !editingProvider) return;

    const specialties = editingProvider.specialties || [];
    if (!specialties.includes(newSpecialty.trim())) {
      setEditingProvider({
        ...editingProvider,
        specialties: [...specialties, newSpecialty.trim()],
      });
    }
    setNewSpecialty("");
  };

  const handleRemoveSpecialty = (specialty: string) => {
    if (!editingProvider) return;

    setEditingProvider({
      ...editingProvider,
      specialties: (editingProvider.specialties || []).filter((s) => s !== specialty),
    });
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
              <CardTitle>Providers</CardTitle>
              <CardDescription>
                Manage your medical providers and staff
              </CardDescription>
            </div>
            <Button onClick={() => handleEditProvider()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Provider
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Specialties</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">{provider.name}</TableCell>
                  <TableCell>{provider.email}</TableCell>
                  <TableCell>{provider.phone || "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {provider.specialties?.slice(0, 2).map((specialty) => (
                        <Badge key={specialty} variant="outline" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                      {provider.specialties && provider.specialties.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{provider.specialties.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={provider.is_active ? "default" : "secondary"}>
                      {provider.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditProvider(provider)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProvider(provider.id)}
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

      {/* Edit Provider Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProvider?.id ? "Edit Provider" : "Add Provider"}
            </DialogTitle>
            <DialogDescription>
              Configure provider details and specialties
            </DialogDescription>
          </DialogHeader>
          {editingProvider && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={editingProvider.name || ""}
                    onChange={(e) =>
                      setEditingProvider({ ...editingProvider, name: e.target.value })
                    }
                    placeholder="Dr. Jane Smith"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editingProvider.email || ""}
                    onChange={(e) =>
                      setEditingProvider({ ...editingProvider, email: e.target.value })
                    }
                    placeholder="doctor@example.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={editingProvider.phone || ""}
                    onChange={(e) =>
                      setEditingProvider({ ...editingProvider, phone: e.target.value })
                    }
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hire_date">Hire Date</Label>
                  <Input
                    id="hire_date"
                    type="date"
                    value={editingProvider.hire_date || ""}
                    onChange={(e) =>
                      setEditingProvider({ ...editingProvider, hire_date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Specialties</Label>
                <div className="flex gap-2">
                  <Input
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSpecialty();
                      }
                    }}
                    placeholder="Add a specialty"
                  />
                  <Button type="button" onClick={handleAddSpecialty}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(editingProvider.specialties || []).map((specialty) => (
                    <Badge
                      key={specialty}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {specialty}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => handleRemoveSpecialty(specialty)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio / Role Description</Label>
                <Textarea
                  id="bio"
                  value={editingProvider.bio || ""}
                  onChange={(e) =>
                    setEditingProvider({ ...editingProvider, bio: e.target.value })
                  }
                  rows={4}
                  placeholder="Medical Director | Board Certified Dermatologist with 15 years of experience..."
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={editingProvider.is_active !== false}
                  onCheckedChange={(checked) =>
                    setEditingProvider({ ...editingProvider, is_active: checked })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProvider}>Save Provider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
