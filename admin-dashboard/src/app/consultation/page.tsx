"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mic, Square, Upload, Loader2, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

type Provider = {
  id: string;
  name: string;
  email: string;
  specialties: string[];
};

type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string;
};

type ConsultationState = {
  consultationId: string | null;
  providerId: string;
  customerId: number | null;
  serviceType: string;
  outcome: "booked" | "declined" | "thinking" | "follow_up_needed" | "";
  notes: string;
  recording: Blob | null;
  status: "idle" | "recording" | "uploading" | "processing" | "completed";
};

const SERVICES = [
  "Botox",
  "Dermal Fillers",
  "Laser Hair Removal",
  "Chemical Peels",
  "Microneedling",
  "Hydrafacial",
  "PDO Thread Lift",
  "PRP Facial",
  "Body Contouring"
];

export default function ConsultationPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [state, setState] = useState<ConsultationState>({
    consultationId: null,
    providerId: "",
    customerId: null,
    serviceType: "",
    outcome: "",
    notes: "",
    recording: null,
    status: "idle"
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load providers on mount
  useEffect(() => {
    fetchProviders();
    fetchCustomers();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/providers");
      const data = await res.json();
      setProviders(data.providers || []);
    } catch (error) {
      console.error("Failed to fetch providers:", error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    }
  };

  const startRecording = async () => {
    try {
      // Create consultation record
      const consultationRes = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: state.providerId,
          customer_id: state.customerId,
          service_type: state.serviceType || null
        })
      });

      const consultation = await consultationRes.json();

      setState(prev => ({
        ...prev,
        consultationId: consultation.id,
        status: "recording"
      }));

      // Start audio recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setState(prev => ({ ...prev, recording: audioBlob }));
      };

      mediaRecorder.start();

      // Start timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Failed to start recording. Please check microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setState(prev => ({ ...prev, status: "idle" }));
  };

  const uploadRecording = async () => {
    if (!state.recording || !state.consultationId) return;

    setState(prev => ({ ...prev, status: "uploading" }));

    try {
      const formData = new FormData();
      formData.append("audio", state.recording, "consultation.webm");

      const uploadRes = await fetch(
        `/api/consultations/${state.consultationId}/upload-audio`,
        {
          method: "POST",
          body: formData
        }
      );

      if (!uploadRes.ok) throw new Error("Upload failed");

      await completeConsultation();

    } catch (error) {
      console.error("Failed to upload recording:", error);
      alert("Failed to upload recording");
      setState(prev => ({ ...prev, status: "idle" }));
    }
  };

  const completeConsultation = async () => {
    if (!state.consultationId || !state.outcome) return;

    setState(prev => ({ ...prev, status: "processing" }));

    try {
      const endRes = await fetch(
        `/api/consultations/${state.consultationId}/end`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outcome: state.outcome,
            notes: state.notes || null
          })
        }
      );

      if (!endRes.ok) throw new Error("Failed to complete consultation");

      setState({
        consultationId: null,
        providerId: state.providerId, // Keep provider selected
        customerId: null,
        serviceType: "",
        outcome: "",
        notes: "",
        recording: null,
        status: "completed"
      });

      // Reset completed status after 3 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, status: "idle" }));
      }, 3000);

    } catch (error) {
      console.error("Failed to complete consultation:", error);
      alert("Failed to complete consultation");
      setState(prev => ({ ...prev, status: "idle" }));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const canStartRecording = state.providerId && state.status === "idle";
  const canStopRecording = state.status === "recording";
  const canSubmit = state.recording && state.outcome && state.status === "idle";

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">In-Person Consultation</h1>
        <p className="text-muted-foreground mt-2">
          Record and transcribe in-person consultations for AI analysis
        </p>
      </div>

      <div className="grid gap-6">
        {/* Recording Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              {state.status === "recording" ? "Recording..." : "Voice Recording"}
            </CardTitle>
            <CardDescription>
              Tap the microphone to start recording the consultation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              {state.status === "recording" && (
                <div className="text-5xl font-mono font-bold text-red-600 animate-pulse">
                  {formatTime(recordingTime)}
                </div>
              )}

              {state.recording && state.status === "idle" && (
                <div className="text-green-600 flex items-center gap-2">
                  <CheckCircle className="h-6 w-6" />
                  <span>Recording saved ({formatTime(recordingTime)})</span>
                </div>
              )}

              <div className="flex gap-4">
                {!canStopRecording && !state.recording && (
                  <Button
                    size="lg"
                    onClick={startRecording}
                    disabled={!canStartRecording || state.status !== "idle"}
                    className="h-20 w-20 rounded-full"
                  >
                    <Mic className="h-8 w-8" />
                  </Button>
                )}

                {canStopRecording && (
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={stopRecording}
                    className="h-20 w-20 rounded-full"
                  >
                    <Square className="h-8 w-8" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Consultation Details */}
        <Card>
          <CardHeader>
            <CardTitle>Consultation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider *</Label>
                <Select
                  value={state.providerId}
                  onValueChange={(value) =>
                    setState(prev => ({ ...prev, providerId: value }))
                  }
                  disabled={state.status === "recording"}
                >
                  <SelectTrigger id="provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer">Customer (Optional)</Label>
                <Select
                  value={state.customerId?.toString() || ""}
                  onValueChange={(value) =>
                    setState(prev => ({ ...prev, customerId: parseInt(value) }))
                  }
                  disabled={state.status === "recording"}
                >
                  <SelectTrigger id="customer">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.name} - {customer.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service">Service Type</Label>
                <Select
                  value={state.serviceType}
                  onValueChange={(value) =>
                    setState(prev => ({ ...prev, serviceType: value }))
                  }
                  disabled={state.status === "recording"}
                >
                  <SelectTrigger id="service">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICES.map((service) => (
                      <SelectItem key={service} value={service}>
                        {service}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="outcome">Outcome *</Label>
                <Select
                  value={state.outcome}
                  onValueChange={(value: any) =>
                    setState(prev => ({ ...prev, outcome: value }))
                  }
                  disabled={state.status === "recording" || !state.recording}
                >
                  <SelectTrigger id="outcome">
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                    <SelectItem value="thinking">Thinking</SelectItem>
                    <SelectItem value="follow_up_needed">Follow-up Needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about the consultation..."
                value={state.notes}
                onChange={(e) =>
                  setState(prev => ({ ...prev, notes: e.target.value }))
                }
                disabled={state.status === "recording"}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          size="lg"
          onClick={uploadRecording}
          disabled={!canSubmit || state.status !== "idle"}
          className="w-full"
        >
          {state.status === "uploading" && (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Uploading Recording...
            </>
          )}
          {state.status === "processing" && (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Analyzing with AI...
            </>
          )}
          {state.status === "completed" && (
            <>
              <CheckCircle className="mr-2 h-5 w-5" />
              Consultation Saved!
            </>
          )}
          {state.status === "idle" && (
            <>
              <Upload className="mr-2 h-5 w-5" />
              Submit Consultation
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
