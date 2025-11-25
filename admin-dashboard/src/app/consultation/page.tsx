"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mic, Square, Upload, Loader2, CheckCircle, FileAudio, User, Calendar, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
      const res = await fetch("/api/admin/providers");
      if (!res.ok) {
        throw new Error(`Failed to load providers: ${res.status}`);
      }
      const data = await res.json();
      setProviders(Array.isArray(data) ? data : []);
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
        className="max-w-4xl mx-auto space-y-8"
      >
        <motion.header variants={itemVariants} className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 text-white shadow-lg shadow-sky-500/20">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">In-Person Consultation</h1>
              <p className="text-sm text-zinc-500">Record and transcribe live consultations for AI analysis</p>
            </div>
          </div>
        </motion.header>

        <motion.div variants={itemVariants} className="grid gap-6">
          {/* Recording Card */}
          <Card className="overflow-hidden border-zinc-200 bg-white/80 backdrop-blur-sm shadow-sm transition-all hover:shadow-md hover:border-sky-200">
            <CardHeader className="bg-zinc-50/30 border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-2">
                <FileAudio className="h-5 w-5 text-sky-500" />
                <CardTitle className="text-lg font-semibold text-zinc-900">
                  {state.status === "recording" ? "Recording in Progress" : "Voice Recording"}
                </CardTitle>
              </div>
              <CardDescription>
                {state.status === "recording" 
                  ? "Ensure clear audio capture. Keep device close to conversation." 
                  : "Tap the microphone to start recording the consultation"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-8 pb-8">
              <div className="flex flex-col items-center justify-center space-y-6">
                <AnimatePresence mode="wait">
                  {state.status === "recording" && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="text-6xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-600 animate-pulse tracking-tighter"
                    >
                      {formatTime(recordingTime)}
                    </motion.div>
                  )}
                  
                  {state.status !== "recording" && state.recording && (
                     <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-emerald-600 flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100"
                     >
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Recording saved ({formatTime(recordingTime)})</span>
                     </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-6 items-center">
                  {!canStopRecording && !state.recording && (
                    <div className="relative group">
                      <div className="absolute inset-0 bg-sky-500/20 rounded-full blur-xl group-hover:bg-sky-500/30 transition-all opacity-0 group-hover:opacity-100" />
                      <Button
                        size="lg"
                        onClick={startRecording}
                        disabled={!canStartRecording || state.status !== "idle"}
                        className={cn(
                          "relative h-24 w-24 rounded-full border-4 transition-all duration-300 shadow-xl",
                          !canStartRecording 
                             ? "bg-zinc-100 border-zinc-200 text-zinc-300"
                             : "bg-gradient-to-br from-sky-500 to-teal-500 border-white text-white hover:scale-105 hover:shadow-sky-500/25"
                        )}
                      >
                        <Mic className={cn("h-10 w-10", !canStartRecording && "text-zinc-300")} />
                      </Button>
                    </div>
                  )}

                  {canStopRecording && (
                    <div className="relative group">
                      <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl group-hover:bg-red-500/30 transition-all" />
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={stopRecording}
                        className="relative h-24 w-24 rounded-full border-4 border-white bg-gradient-to-br from-red-500 to-pink-600 shadow-xl hover:scale-105 transition-all duration-300 hover:shadow-red-500/25"
                      >
                        <Square className="h-10 w-10 fill-current" />
                      </Button>
                    </div>
                  )}

                  {state.recording && !canStopRecording && (
                     <Button
                        variant="outline"
                        onClick={() => setState(prev => ({ ...prev, recording: null, status: "idle" }))}
                        className="rounded-full px-6 border-zinc-200 hover:bg-zinc-50 hover:text-red-600 hover:border-red-100"
                     >
                        Reset
                     </Button>
                  )}
                </div>
                
                {!state.providerId && (
                   <p className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-md border border-amber-100">
                      Please select a provider to start recording
                   </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Consultation Details */}
          <Card className="border-zinc-200 bg-white/80 backdrop-blur-sm shadow-sm">
            <CardHeader className="bg-zinc-50/30 border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-teal-500" />
                <CardTitle className="text-lg font-semibold text-zinc-900">Consultation Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="provider" className="text-zinc-900 flex items-center gap-2">
                     <User className="h-3.5 w-3.5 text-zinc-500" />
                     Provider <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={state.providerId}
                    onValueChange={(value: string) =>
                      setState(prev => ({ ...prev, providerId: value }))
                    }
                    disabled={state.status === "recording"}
                  >
                    <SelectTrigger id="provider" className="bg-white border-zinc-200 focus:ring-sky-500/20 focus:border-sky-500 transition-all">
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
                  <Label htmlFor="customer" className="text-zinc-900 flex items-center gap-2">
                     <User className="h-3.5 w-3.5 text-zinc-500" />
                     Customer <span className="text-zinc-400 font-normal">(Optional)</span>
                  </Label>
                  <Select
                    value={state.customerId?.toString() || ""}
                    onValueChange={(value: string) =>
                      setState(prev => ({ ...prev, customerId: parseInt(value, 10) || null }))
                    }
                    disabled={state.status === "recording"}
                  >
                    <SelectTrigger id="customer" className="bg-white border-zinc-200 focus:ring-sky-500/20 focus:border-sky-500 transition-all">
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
                  <Label htmlFor="service" className="text-zinc-900 flex items-center gap-2">
                     <Activity className="h-3.5 w-3.5 text-zinc-500" />
                     Service Type
                  </Label>
                  <Select
                    value={state.serviceType}
                    onValueChange={(value: string) =>
                      setState(prev => ({ ...prev, serviceType: value }))
                    }
                    disabled={state.status === "recording"}
                  >
                    <SelectTrigger id="service" className="bg-white border-zinc-200 focus:ring-sky-500/20 focus:border-sky-500 transition-all">
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
                  <Label htmlFor="outcome" className="text-zinc-900 flex items-center gap-2">
                     <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                     Outcome <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={state.outcome}
                    onValueChange={(value: ConsultationState["outcome"]) =>
                      setState(prev => ({ ...prev, outcome: value }))
                    }
                    disabled={state.status === "recording" || !state.recording}
                  >
                    <SelectTrigger id="outcome" className={cn(
                       "bg-white border-zinc-200 focus:ring-sky-500/20 focus:border-sky-500 transition-all",
                       !state.recording && "opacity-50 cursor-not-allowed"
                    )}>
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
                <Label htmlFor="notes" className="text-zinc-900">Notes <span className="text-zinc-400 font-normal text-xs ml-1">(Optional)</span></Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional context or notes about the consultation..."
                  value={state.notes}
                  onChange={(e) =>
                    setState(prev => ({ ...prev, notes: e.target.value }))
                  }
                  disabled={state.status === "recording"}
                  rows={4}
                  className="bg-white border-zinc-200 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            size="lg"
            onClick={uploadRecording}
            disabled={!canSubmit || state.status !== "idle"}
            className={cn(
               "w-full h-12 text-base font-semibold shadow-lg transition-all",
               canSubmit 
                  ? "bg-gradient-to-r from-sky-500 to-teal-500 text-white hover:from-sky-600 hover:to-teal-600 shadow-sky-500/20" 
                  : "bg-zinc-100 text-zinc-400 shadow-none border border-zinc-200"
            )}
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
        </motion.div>
      </motion.div>
    </div>
  );
}
