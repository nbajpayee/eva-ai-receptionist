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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Star, Clock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Location {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  is_primary: boolean;
  is_active: boolean;
}

interface BusinessHours {
  id?: number;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function LocationsSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isHoursDialogOpen, setIsHoursDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Partial<Location> | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/locations");
      if (!response.ok) throw new Error("Failed to fetch locations");
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error("Failed to load locations", error);
      toast({
        title: "Error",
        description: "Failed to load locations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const fetchBusinessHours = useCallback(
    async (locationId: number) => {
      try {
        const response = await fetch(`/api/admin/locations/${locationId}/hours`);
        if (!response.ok) throw new Error("Failed to fetch business hours");
        const data = await response.json();

        // Ensure all 7 days are present
        const allDays = Array.from({ length: 7 }, (_, i) => {
          const existing = data.find((h: BusinessHours) => h.day_of_week === i);
          return existing || {
            day_of_week: i,
            open_time: "09:00",
            close_time: "17:00",
            is_closed: i === 6, // Sunday closed by default
          };
        });

        setBusinessHours(allDays);
      } catch (error) {
        console.error("Failed to load business hours", error);
        toast({
          title: "Error",
          description: "Failed to load business hours",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const handleEditLocation = (location: Location | null = null) => {
    if (location) {
      setEditingLocation(location);
    } else {
      setEditingLocation({
        name: "",
        address: "",
        phone: "",
        is_primary: false,
        is_active: true,
      });
    }
    setIsEditDialogOpen(true);
  };

  const handleSaveLocation = async () => {
    if (!editingLocation) return;

    try {
      const url = editingLocation.id
        ? `/api/admin/locations/${editingLocation.id}`
        : "/api/admin/locations";

      const method = editingLocation.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingLocation),
      });

      if (!response.ok) throw new Error("Failed to save location");

      toast({
        title: "Success",
        description: `Location ${editingLocation.id ? "updated" : "created"} successfully`,
      });

      setIsEditDialogOpen(false);
      fetchLocations();
    } catch (error) {
      console.error("Failed to save location", error);
      toast({
        title: "Error",
        description: "Failed to save location",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLocation = async (id: number) => {
    if (!confirm("Are you sure you want to delete this location?")) return;

    try {
      const response = await fetch(`/api/admin/locations/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to delete location");
      }

      toast({
        title: "Success",
        description: "Location deleted successfully",
      });

      fetchLocations();
    } catch (error: unknown) {
      console.error("Failed to delete location", error);
      const message =
        error instanceof Error ? error.message : "Failed to delete location";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleEditHours = async (location: Location) => {
    setSelectedLocation(location);
    await fetchBusinessHours(location.id);
    setIsHoursDialogOpen(true);
  };

  const handleSaveHours = async () => {
    if (!selectedLocation) return;

    try {
      const response = await fetch(`/api/admin/locations/${selectedLocation.id}/hours`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(businessHours),
      });

      if (!response.ok) throw new Error("Failed to save business hours");

      toast({
        title: "Success",
        description: "Business hours saved successfully",
      });

      setIsHoursDialogOpen(false);
    } catch (error) {
      console.error("Failed to save business hours", error);
      toast({
        title: "Error",
        description: "Failed to save business hours",
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
              <CardTitle>Locations</CardTitle>
              <CardDescription>
                Manage your med spa locations and business hours
              </CardDescription>
            </div>
            <Button onClick={() => handleEditLocation()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {location.name}
                      {location.is_primary && (
                        <Badge variant="secondary" className="ml-2">
                          <Star className="h-3 w-3 mr-1" />
                          Primary
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{location.address}</TableCell>
                  <TableCell>{location.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={location.is_active ? "default" : "secondary"}>
                      {location.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditHours(location)}
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditLocation(location)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteLocation(location.id)}
                        disabled={location.is_primary}
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

      {/* Edit Location Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLocation?.id ? "Edit Location" : "Add Location"}
            </DialogTitle>
            <DialogDescription>
              Configure location details
            </DialogDescription>
          </DialogHeader>
          {editingLocation && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={editingLocation.name || ""}
                  onChange={(e) =>
                    setEditingLocation({ ...editingLocation, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={editingLocation.address || ""}
                  onChange={(e) =>
                    setEditingLocation({ ...editingLocation, address: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={editingLocation.phone || ""}
                  onChange={(e) =>
                    setEditingLocation({ ...editingLocation, phone: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is_primary">Primary Location</Label>
                <Switch
                  id="is_primary"
                  checked={editingLocation.is_primary || false}
                  onCheckedChange={(checked: boolean) =>
                    setEditingLocation({ ...editingLocation, is_primary: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={editingLocation.is_active !== false}
                  onCheckedChange={(checked: boolean) =>
                    setEditingLocation({ ...editingLocation, is_active: checked })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLocation}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Business Hours Dialog */}
      <Dialog open={isHoursDialogOpen} onOpenChange={setIsHoursDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Business Hours - {selectedLocation?.name}</DialogTitle>
            <DialogDescription>
              Set operating hours for each day of the week
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {businessHours.map((hours, index) => (
              <div key={hours.day_of_week} className="flex items-center gap-4">
                <div className="w-28 font-medium">{DAY_NAMES[hours.day_of_week]}</div>
                <div className="flex items-center gap-2 flex-1">
                  <Switch
                    checked={!hours.is_closed}
                    onCheckedChange={(checked: boolean) => {
                      const newHours = [...businessHours];
                      newHours[index].is_closed = !checked;
                      setBusinessHours(newHours);
                    }}
                  />
                  {!hours.is_closed ? (
                    <>
                      <Input
                        type="time"
                        value={hours.open_time || "09:00"}
                        onChange={(e) => {
                          const newHours = [...businessHours];
                          newHours[index].open_time = e.target.value;
                          setBusinessHours(newHours);
                        }}
                        className="w-32"
                      />
                      <span>to</span>
                      <Input
                        type="time"
                        value={hours.close_time || "17:00"}
                        onChange={(e) => {
                          const newHours = [...businessHours];
                          newHours[index].close_time = e.target.value;
                          setBusinessHours(newHours);
                        }}
                        className="w-32"
                      />
                    </>
                  ) : (
                    <span className="text-muted-foreground">Closed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHoursDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveHours}>Save Hours</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
