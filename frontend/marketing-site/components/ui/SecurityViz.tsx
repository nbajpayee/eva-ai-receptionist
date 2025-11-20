"use client";

import { motion } from "framer-motion";
import { Shield, Lock, FileText, Server } from "lucide-react";

export default function SecurityViz() {
  return (
    <div className="relative w-full h-full min-h-[400px] bg-slate-900 rounded-3xl overflow-hidden flex items-center justify-center">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-20" 
        style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
      />

      {/* Central Shield */}
      <div className="relative z-10">
        <motion.div
          animate={{ boxShadow: ["0 0 20px rgba(99, 102, 241, 0.3)", "0 0 60px rgba(99, 102, 241, 0.6)", "0 0 20px rgba(99, 102, 241, 0.3)"] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-32 h-32 bg-gradient-to-b from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-2xl border border-indigo-400"
        >
          <Shield className="w-16 h-16 text-white" />
        </motion.div>

        {/* Floating Badges */}
        <motion.div 
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 0 }}
          className="absolute -top-12 -right-16 bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-lg flex items-center gap-2"
        >
           <Lock className="w-4 h-4 text-green-400" />
           <div className="text-xs text-white font-mono">AES-256 Encrypted</div>
        </motion.div>

        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity, delay: 1 }}
          className="absolute -bottom-8 -left-16 bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-lg flex items-center gap-2"
        >
           <FileText className="w-4 h-4 text-blue-400" />
           <div className="text-xs text-white font-mono">BAA Signed</div>
        </motion.div>
        
        <motion.div 
          animate={{ x: [0, 5, 0] }}
          transition={{ duration: 6, repeat: Infinity, delay: 0.5 }}
          className="absolute top-1/2 -right-24 bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-lg flex items-center gap-2"
        >
           <Server className="w-4 h-4 text-purple-400" />
           <div className="text-xs text-white font-mono">HIPAA Cloud</div>
        </motion.div>
      </div>

      {/* Data Streams */}
      <div className="absolute inset-0 pointer-events-none">
         {[...Array(5)].map((_, i) => (
           <motion.div
             key={i}
             className="absolute h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent w-full"
             style={{ top: `${20 + i * 15}%`, left: '-100%' }}
             animate={{ left: '100%' }}
             transition={{ duration: 3, repeat: Infinity, delay: i * 0.8, ease: "linear" }}
           />
         ))}
      </div>
    </div>
  );
}

