"use client";

import { motion } from "framer-motion";
import { Phone, Calendar, MessageSquare, Mail, CreditCard, Users, Bell } from "lucide-react";

const INTEGRATION_LOGOS = [
  // Added minimal x-offset (1px) to vertical lines to ensure SVG gradients render correctly
  { name: "Boulevard", icon: Calendar, color: "bg-purple-500", x: 1, y: -120 },
  { name: "Zenoti", icon: Users, color: "bg-orange-500", x: 100, y: -60 },
  { name: "Vagaro", icon: CreditCard, color: "bg-red-500", x: 100, y: 60 },
  { name: "Jane App", icon: Bell, color: "bg-blue-500", x: -1, y: 120 },
  { name: "Twilio", icon: MessageSquare, color: "bg-red-600", x: -100, y: 60 },
  { name: "SendGrid", icon: Mail, color: "bg-blue-600", x: -100, y: -60 },
];

export default function IntegrationsViz() {
  return (
    <div className="relative w-full h-[500px] flex items-center justify-center overflow-visible">
      {/* Connections Layer - Centered Origin */}
      <div className="absolute left-1/2 top-1/2 w-0 h-0 z-0">
        <svg className="overflow-visible">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          
          {INTEGRATION_LOGOS.map((logo, index) => (
            <g key={logo.name}>
              {/* Connecting Line */}
              <motion.line
                x1="0"
                y1="0"
                initial={{ x2: 0, y2: 0, opacity: 0 }}
                animate={{ x2: logo.x, y2: logo.y, opacity: 1 }}
                transition={{ delay: index * 0.1, type: "spring", stiffness: 100 }}
                stroke="url(#lineGradient)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              
              {/* Particle moving from Center (0,0) to App (x,y) */}
              <motion.circle
                r="3"
                fill="#0ea5e9"
                initial={{ cx: 0, cy: 0 }}
                animate={{ 
                  cx: [0, logo.x],
                  cy: [0, logo.y],
                  opacity: [0, 1, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: index * 0.2 + 1,
                  ease: "easeInOut"
                }}
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Center Hub (Eva) */}
      <div className="relative z-20 w-24 h-24 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-primary-50">
        <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-inner">
          <Phone className="w-8 h-8 text-white" />
        </div>
        {/* Pulsing Ring */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute inset-0 rounded-full border-2 border-primary-200"
        />
      </div>

      {/* Satellite Nodes */}
      {INTEGRATION_LOGOS.map((logo, index) => (
        <motion.div
          key={logo.name}
          className="absolute z-10"
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: logo.x, y: logo.y, opacity: 1 }}
          transition={{ delay: index * 0.1, type: "spring", stiffness: 100 }}
        >
          {/* Icon Node */}
          <div className="relative group cursor-pointer">
            <div className="absolute inset-0 bg-white rounded-full blur-md opacity-0 group-hover:opacity-50 transition-opacity" />
            <div className="w-16 h-16 bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center relative z-10 hover:-translate-y-1 transition-transform duration-300">
              <div className={`w-10 h-10 rounded-full ${logo.color} flex items-center justify-center opacity-90`}>
                <logo.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            {/* Tooltip */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap">
              {logo.name}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
