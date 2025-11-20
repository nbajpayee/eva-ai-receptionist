"use client";

import { motion } from "framer-motion";
import AudioWaveform from "@/components/ui/AudioWaveform";
import { Mic, Zap, Wifi } from "lucide-react";

export default function VoiceAIViz() {
  return (
    <div className="relative w-full h-full min-h-[480px] bg-slate-950 rounded-3xl overflow-hidden flex flex-col items-center border border-slate-800/50 shadow-2xl pt-12 pb-20">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center w-full max-w-[340px] px-6 flex-1">
        {/* AI Core Visualization */}
        <div className="relative mb-8 group shrink-0">
           {/* Outer Pulse Rings */}
           <motion.div 
             animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0, 0.1] }}
             transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
             className="absolute inset-0 bg-cyan-400/20 rounded-full blur-2xl"
           />
           <motion.div 
             animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.1, 0.2] }}
             transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
             className="absolute inset-0 bg-blue-500/30 rounded-full blur-xl"
           />
           
           {/* Main Orb Container */}
           <div className="w-24 h-24 rounded-full bg-slate-900 border border-slate-700/50 flex items-center justify-center relative z-10 shadow-[0_0_40px_-10px_rgba(56,189,248,0.3)]">
              {/* Inner Gradient Core */}
              <motion.div 
                animate={{ scale: [0.9, 1.05, 0.9], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.5)] flex items-center justify-center"
              >
                <Zap className="w-5 h-5 text-white drop-shadow-md" fill="currentColor" />
              </motion.div>
              
              {/* Spinning ring accent */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border border-cyan-500/10 border-t-cyan-500/40"
              />
           </div>
        </div>

        {/* Integrated Waveform Pill */}
        <div className="mb-8 w-full max-w-[180px] h-10 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/5 flex items-center justify-center shadow-inner shrink-0">
          <div className="opacity-80 scale-75">
            <AudioWaveform color="bg-cyan-400" />
          </div>
        </div>

        {/* Transcript Bubbles */}
        <div className="w-full space-y-3 flex-1">
           {/* User Message */}
           <motion.div 
             initial={{ opacity: 0, y: 10, scale: 0.95 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }}
             className="flex justify-end"
           >
             <div className="bg-slate-800/40 backdrop-blur-sm border border-white/5 text-slate-200 px-4 py-3 rounded-2xl rounded-tr-sm shadow-sm max-w-[90%]">
               <p className="text-sm font-light leading-relaxed">Can you book me for a facial next Friday?</p>
             </div>
           </motion.div>

           {/* Eva Message */}
           <motion.div 
             initial={{ opacity: 0, y: 10, scale: 0.95 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             transition={{ delay: 1.8, duration: 0.4, ease: "easeOut" }}
             className="flex justify-start"
           >
             <div className="bg-gradient-to-br from-blue-900/30 to-slate-900/30 backdrop-blur-md border border-blue-500/20 text-blue-50 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm max-w-[90%]">
               <p className="text-sm font-light leading-relaxed">
                 Absolutely. I have an opening at 2:00 PM. Shall I book that for you?
               </p>
             </div>
           </motion.div>
        </div>
      </div>
      
      {/* Status Footer */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 px-6 z-20">
         <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-lg">
           <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </div>
           <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Live</span>
         </div>
         
         <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-lg">
           <Wifi className="w-3 h-3 text-slate-500" />
           <span className="text-[10px] font-medium text-slate-400">120ms</span>
         </div>

         <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-lg">
           <Mic className="w-3 h-3 text-slate-500" />
           <span className="text-[10px] font-medium text-slate-400">OpenAI</span>
         </div>
      </div>
    </div>
  );
}
