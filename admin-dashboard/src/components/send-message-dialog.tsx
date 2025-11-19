"use client";

import { useState } from "react";
import { Mail, MessageSquare, Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type SendMessageDialogProps = {
  customerId: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

type SendMessagePayload = {
  channel: "sms" | "email";
  content: string;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  subject?: string;
};

export function SendMessageDialog({
  customerId,
  customerName,
  customerPhone,
  customerEmail,
  open,
  onOpenChange,
  onSuccess,
}: SendMessageDialogProps) {
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResponse(null);
    setLoading(true);

    try {
      // Validate channel requirements
      if (channel === "sms" && !customerPhone) {
        setError("Customer phone number is required for SMS");
        setLoading(false);
        return;
      }
      if (channel === "email" && !customerEmail) {
        setError("Customer email address is required for email");
        setLoading(false);
        return;
      }

      const requestBody: SendMessagePayload = {
        channel,
        content: message,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
      };

      if (channel === "email" && subject) {
        requestBody.subject = subject;
      }

      const res = await fetch("/api/admin/messaging/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || errorData.error || "Failed to send message");
      }

      const data = await res.json();

      // Show AI response
      if (data.assistant_message && data.assistant_message.content) {
        setResponse(data.assistant_message.content);
      }

      // Reset form
      setMessage("");
      setSubject("");

      // Call success callback after a short delay to show response
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
        setResponse(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setMessage("");
      setSubject("");
      setError(null);
      setResponse(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Send Message</DialogTitle>
          <DialogDescription>
            Send an SMS or email to {customerName}. Ava AI will automatically respond.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSend} className="space-y-4">
          {/* Channel Selection */}
          <div className="space-y-2">
            <Label>Channel</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setChannel("sms")}
                disabled={!customerPhone}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-all ${
                  channel === "sms"
                    ? "border-sky-500 bg-sky-50 text-sky-900"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                } ${!customerPhone ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium">SMS</span>
                {!customerPhone && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    No phone
                  </Badge>
                )}
              </button>

              <button
                type="button"
                onClick={() => setChannel("email")}
                disabled={!customerEmail}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-all ${
                  channel === "email"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                } ${!customerEmail ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <Mail className="h-4 w-4" />
                <span className="font-medium">Email</span>
                {!customerEmail && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    No email
                  </Badge>
                )}
              </button>
            </div>
          </div>

          {/* Contact Info Display */}
          <div className="rounded-lg bg-zinc-50 p-3 text-sm">
            <span className="text-zinc-600">To: </span>
            <span className="font-medium text-zinc-900">
              {channel === "sms" ? customerPhone : customerEmail}
            </span>
          </div>

          {/* Subject (Email only) */}
          {channel === "email" && (
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject (optional)"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          )}

          {/* Message Content */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={6}
              placeholder={
                channel === "sms"
                  ? "Type your SMS message..."
                  : "Type your email message..."
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* AI Response Display */}
          {response && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                <MessageSquare className="h-4 w-4" />
                <span>Ava&apos;s Response:</span>
              </div>
              <p className="text-sm text-emerald-800">{response}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !message.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send {channel === "sms" ? "SMS" : "Email"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
