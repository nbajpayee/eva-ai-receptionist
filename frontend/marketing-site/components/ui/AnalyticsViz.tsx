"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Smile } from "lucide-react";

export default function AnalyticsViz() {
  return (
    <div className="relative w-full h-full min-h-[420px] rounded-3xl overflow-hidden border border-slate-800/60 bg-slate-950 shadow-2xl flex flex-col pt-8 pb-6">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black" />
      <div className="absolute top-0 right-0 w-[400px] h-[300px] bg-blue-500/5 blur-[100px] pointer-events-none" />

      {/* Header Metric */}
      <div className="relative z-10 px-8 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Avg. Customer Satisfaction</h3>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-white tracking-tight">4.8</span>
              <span className="text-lg text-slate-500 font-medium">/ 5.0</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full text-emerald-400 text-sm font-semibold shadow-sm">
              <ArrowUpRight className="w-4 h-4" />
              <span>26%</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">vs. previous period</p>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="relative flex-1 px-8 flex items-end pb-4">
        {/* Grid lines */}
        <div className="absolute inset-0 px-8 flex flex-col justify-end pb-8 space-y-10 pointer-events-none opacity-10">
          <div className="border-t border-slate-400 w-full" />
          <div className="border-t border-slate-400 w-full" />
          <div className="border-t border-slate-400 w-full" />
        </div>

        {/* Chart Container */}
        <div className="relative w-full h-[180px] flex items-end">
          {/* "Before Eva" Path (Static/Faded) */}
          <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
            <path
              d="M0,140 C40,130 80,150 120,120 C160,135 180,130 200,130"
              fill="none"
              stroke="#475569"
              strokeWidth="2.5"
              strokeDasharray="4 4"
              className="opacity-40"
            />
            {/* Vertical Divider Line */}
            <line x1="200" y1="0" x2="200" y2="180" stroke="#64748b" strokeWidth="1" strokeDasharray="2 2" className="opacity-30" />
          </svg>

          {/* "After Eva" Path (Animated) */}
          <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(34, 211, 238, 0.15)" />
                <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
              </linearGradient>
            </defs>
            
            {/* Area Fill */}
            <motion.path
              d="M200,130 C240,90 280,70 320,50 C360,40 400,30 480,20 L480,180 L200,180 Z"
              fill="url(#areaGradient)"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.4 }}
            />

            {/* Line Stroke */}
            <motion.path
              d="M200,130 C240,90 280,70 320,50 C360,40 400,30 480,20"
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            />
          </svg>

          {/* "Eva Enabled" Marker - Positioned at start of "After" curve (x=200, y=130) */}
          <motion.div 
            className="absolute left-[160px] top-[125px] -translate-x-1/2 translate-y-full flex flex-col items-center gap-2 z-10"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
          >
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] ring-2 ring-slate-950" />
            <div className="bg-slate-800 border border-slate-700 text-[10px] font-semibold text-slate-300 px-2 py-1 rounded shadow-md whitespace-nowrap">
              Eva Enabled
            </div>
          </motion.div>

          {/* Pulse Point at End - Positioned at end of curve (x=480, y=20) */}
          <motion.div 
            className="absolute right-[15px] top-[14px] w-3 h-3 -translate-y-1/2 translate-x-1/2"
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.7, type: "spring" }}
          >
            <div className="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-50" />
            <div className="relative w-full h-full bg-white rounded-full shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
          </motion.div>
        </div>
      </div>

      {/* Bottom Legend / Insight */}
      <div className="relative z-10 px-8 flex items-center justify-between mt-2">
        <div className="flex gap-5 text-[10px] font-semibold tracking-wide uppercase">
          <div className="flex items-center gap-2 text-slate-500">
            <div className="w-2 h-2 rounded-full bg-slate-600" />
            Before Eva
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
            With Eva
          </div>
        </div>

        {/* Insight Pill */}
        <motion.div 
          className="hidden sm:flex items-center gap-2 bg-slate-900/90 border border-slate-800 pl-2 pr-3 py-1.5 rounded-full backdrop-blur-md shadow-lg"
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 2 }}
        >
          <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Smile className="w-3 h-3 text-blue-400" />
          </div>
          <span className="text-xs text-slate-300 font-medium">Frustrated calls ↓ 35%</span>
        </motion.div>
      </div>
    </div>
  );
}
