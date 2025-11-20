"use client";

import { Phone, MessageSquare, Mail, Check, Clock } from "lucide-react";
import { motion } from "framer-motion";

const TIMELINE_EVENTS = [
  {
    time: "10:42 AM",
    type: "voice",
    title: "Incoming Call",
    content: "Patient asks about Botox availability for next Tuesday. Eva qualifies and books the slot.",
    icon: Phone,
    color: "bg-blue-500",
  },
  {
    time: "10:45 AM",
    type: "sms",
    title: "SMS Confirmation",
    content: "Hi Sarah, your appointment for Botox is confirmed for Tue, Oct 24 at 2:00 PM. Reply C to confirm.",
    icon: MessageSquare,
    color: "bg-green-500",
  },
  {
    time: "10:46 AM",
    type: "sms",
    title: "Patient Reply",
    content: "C",
    icon: MessageSquare,
    color: "bg-gray-500",
    isIncoming: true,
  },
  {
    time: "10:46 AM",
    type: "email",
    title: "Prep Instructions Sent",
    content: "Pre-treatment instructions: Please avoid alcohol and blood thinners 24h before your appointment...",
    icon: Mail,
    color: "bg-purple-500",
  },
];

export default function OmnichannelTimeline() {
  return (
    <div className="relative max-w-2xl mx-auto p-8 bg-white rounded-3xl border border-gray-200 shadow-xl">
      <div className="absolute top-0 left-8 h-full w-0.5 bg-gray-100" />
      
      <div className="space-y-8 relative">
        {TIMELINE_EVENTS.map((event, index) => {
          const Icon = event.icon;
          return (
            <motion.div 
              key={index}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              className="flex gap-6 relative"
            >
              {/* Icon Node */}
              <div className={`relative z-10 w-16 h-16 rounded-full border-4 border-white shadow-sm flex items-center justify-center shrink-0 ${event.color}`}>
                <Icon className="w-6 h-6 text-white" />
              </div>

              {/* Content Card */}
              <div className={`flex-1 p-5 rounded-2xl border ${event.isIncoming ? 'bg-gray-50 border-gray-100 ml-8' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full ${event.isIncoming ? 'bg-gray-200 text-gray-600' : 'bg-primary-50 text-primary-700'}`}>
                    {event.type}
                  </span>
                  <div className="flex items-center text-xs text-gray-400">
                    <Clock className="w-3 h-3 mr-1" />
                    {event.time}
                  </div>
                </div>
                
                <h4 className="font-bold text-gray-900 mb-1">{event.title}</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {event.content}
                </p>
                
                {!event.isIncoming && (
                  <div className="mt-3 flex items-center text-xs text-green-600 font-medium">
                    <Check className="w-3 h-3 mr-1" />
                    Delivered
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

