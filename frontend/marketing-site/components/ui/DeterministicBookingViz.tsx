"use client";

import { motion } from "framer-motion";
import { Calendar as CalendarIcon, CheckCircle2, Clock, Sparkles } from "lucide-react";

const TIME_SLOTS = ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30", "12:00", "1:00", "1:30", "2:00", "2:30"];
const EXISTING_APPTS = [
  { label: "Staff Meeting", startIndex: 0, span: 2 },
  { label: "Consultation", startIndex: 4, span: 2 },
];

const NEW_BOOKINGS = [
  { label: "Botox – Sarah J.", startIndex: 7, span: 2, delay: 0.4 },
  { label: "Facial – Mark R.", startIndex: 9, span: 2, delay: 1.2 },
  { label: "Laser – Emily K.", startIndex: 2, span: 2, delay: 2.0 },
];

export default function DeterministicBookingViz() {
  return (
    <div className="relative w-full h-full min-h-[420px] rounded-3xl overflow-hidden border border-slate-800/60 bg-slate-950 shadow-2xl pt-4 pb-16">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black" />
      <div className="absolute -top-10 right-0 w-[320px] h-[240px] bg-blue-500/10 blur-[90px]" />

      {/* Calendar chrome */}
      <div className="relative z-10 px-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-100">
          <div className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-700/70 flex items-center justify-center shadow-sm">
            <CalendarIcon className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide uppercase text-slate-400">Today</p>
            <p className="text-sm font-medium text-slate-50">Tuesday, Oct 24</p>
          </div>
        </div>
        <div className="rounded-full bg-slate-900/70 border border-slate-800 px-3 py-1 flex items-center gap-1 text-[11px] text-slate-400 backdrop-blur">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Deterministic Booking</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="relative z-10 mx-4 mb-4 rounded-2xl bg-slate-950/60 border border-slate-800/70 overflow-hidden flex">
        {/* Time column */}
        <div className="w-14 border-r border-slate-800/60 bg-slate-950/80 px-1 pt-3 pb-4 text-[10px] text-slate-500 space-y-4">
          {TIME_SLOTS.filter((_, i) => i % 2 === 0).map((time) => (
            <div key={time} className="h-8 flex items-start justify-end pr-1">
              <span>{time}</span>
            </div>
          ))}
        </div>

        {/* Slots area */}
        <div className="flex-1 relative bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
          {/* Horizontal slot lines */}
          <div className="absolute inset-0 pointer-events-none">
            {TIME_SLOTS.map((_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-b border-dashed border-slate-800/60"
                style={{ top: `${(i / TIME_SLOTS.length) * 100}%` }}
              />
            ))}
          </div>

          {/* Existing appointments */}
          {EXISTING_APPTS.map((appt, idx) => {
            const top = (appt.startIndex / TIME_SLOTS.length) * 100;
            const height = (appt.span / TIME_SLOTS.length) * 100;
            return (
              <div
                key={idx}
                className="absolute left-2 right-[45%] rounded-xl bg-slate-800/70 border border-slate-700/80 px-3 py-2 shadow-sm"
                style={{ top: `${top}%`, height: `${height}%` }}
              >
                <p className="text-[11px] font-medium text-slate-100 truncate">{appt.label}</p>
                <p className="text-[10px] text-slate-400">Existing booking</p>
              </div>
            );
          })}

          {/* Animated new deterministic bookings */}
          {NEW_BOOKINGS.map((booking, idx) => {
            const top = (booking.startIndex / TIME_SLOTS.length) * 100;
            const height = (booking.span / TIME_SLOTS.length) * 100;
            const delay = booking.delay;

            return (
              <motion.div
                key={booking.label}
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                whileInView={{ opacity: 1, scale: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay, duration: 0.45, ease: "easeOut" }}
                className="absolute right-2 left-[48%] rounded-xl bg-gradient-to-r from-emerald-500/80 to-cyan-400/80 border border-emerald-300/60 px-3 py-2 shadow-lg flex items-start justify-between"
                style={{ top: `${top}%`, height: `${height}%` }}
              >
                <div className="pr-2">
                  <p className="text-[11px] font-semibold text-slate-950 truncate">{booking.label}</p>
                  <p className="text-[10px] text-slate-900/80">Booked by Eva</p>
                </div>
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: delay + 0.25, type: "spring", stiffness: 260, damping: 18 }}
                  className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shadow"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Status / tech strip */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3 px-4 z-20">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-sm">
          <Clock className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-medium text-slate-300">Checking availability…</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 backdrop-blur-sm shadow-sm">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] font-medium text-slate-300">No double-bookings</span>
        </div>
      </div>
    </div>
  );
}
