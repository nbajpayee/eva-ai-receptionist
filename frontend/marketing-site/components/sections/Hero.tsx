"use client";

import Link from "next/link";
import { ArrowRight, Play, Phone, MessageSquare, Mail, ShieldCheck, Star } from "lucide-react";
import { motion } from "framer-motion";
import Balancer from "react-wrap-balancer";
import AnimatedStat from "@/components/ui/AnimatedStat";
import AudioWaveform from "@/components/ui/AudioWaveform";
import { STATS } from "@/lib/constants";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-blue-50/50 via-white to-white pt-32 pb-20">
      {/* Background Pattern */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[600px] w-[600px] rounded-full bg-primary-100 opacity-30 blur-[120px]" />
      </div>

      <div className="container-wide">
        <div className="flex flex-col items-center text-center space-y-10 max-w-5xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center space-x-2 bg-white border border-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-medium shadow-sm">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              <span>Trusted by 200+ medical spas nationwide</span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="heading-xl text-gray-900"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Balancer>
              The AI Receptionist That Handles <br />
              <span className="text-primary-600">Voice, SMS, & Email</span>
            </Balancer>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="text-xl md:text-2xl text-gray-600 max-w-3xl leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Balancer>
              Automate appointments, answer questions, and delight patients—all with HIPAA-compliant AI that sounds human and books deterministically.
            </Balancer>
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center gap-4 pt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Link
              href="/contact"
              className="btn-primary text-lg px-8 py-4 group shadow-lg shadow-primary-500/20"
            >
              Book a Demo
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/voice-demo"
              className="btn-secondary text-lg px-8 py-4 group"
            >
              <Play className="mr-2 w-5 h-5 text-primary-600" />
              Hear Eva Live
            </Link>
          </motion.div>

          {/* Trust Signals */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-medium text-gray-500 pt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
              <div className="flex -space-x-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <span className="text-gray-700">4.9/5 on G2</span>
            </div>
            <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
              <ShieldCheck className="w-5 h-5 text-primary-600" />
              <span className="text-gray-700">HIPAA Compliant BAA</span>
            </div>
            <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
              <Phone className="w-4 h-4 text-primary-600" />
              <span className="text-gray-700">99.9% Uptime SLA</span>
            </div>
          </motion.div>

          {/* Interactive Demo Card */}
          <motion.div
            className="w-full max-w-4xl mt-20 relative"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-300 via-primary-100 to-primary-300 rounded-3xl blur opacity-30 animate-pulse" />
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-gray-100 bg-white">
              <div className="grid md:grid-cols-2 min-h-[400px]">
                {/* Left: Visualization */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
                  {/* Decorative circles */}
                  <div className="absolute top-0 left-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center space-x-3 mb-8">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-white/80 text-sm font-medium tracking-wider uppercase">Live Call in Progress</span>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                          <span className="text-2xl">👩‍⚕️</span>
                        </div>
                        <div>
                          <p className="text-white font-medium">Eva (AI Receptionist)</p>
                          <p className="text-white/60 text-sm">Speaking...</p>
                        </div>
                      </div>
                      
                      <div className="h-24 flex items-center justify-center bg-white/5 rounded-2xl backdrop-blur-sm border border-white/10">
                        <AudioWaveform />
                      </div>

                      <div className="flex items-center space-x-4 justify-end opacity-50">
                        <div className="text-right">
                          <p className="text-white font-medium">Sarah (Patient)</p>
                          <p className="text-white/60 text-sm">Listening</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
                          S
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 relative z-10">
                    <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-widest">
                      <span>Voice</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span>Secure</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span>HD Audio</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions/Context */}
                <div className="p-8 md:p-12 bg-white flex flex-col justify-center space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                      <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      Real-time Transcription
                    </h3>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-600 space-y-3 font-medium">
                      <p className="flex gap-3">
                        <span className="text-gray-400 min-w-[60px]">Eva:</span>
                        <span>"I have an opening for Botox with Dr. Smith next Tuesday at 2 PM. Shall I book that for you?"</span>
                      </p>
                      <p className="flex gap-3 text-primary-700">
                        <span className="text-primary-300 min-w-[60px]">Sarah:</span>
                        <span>"Yes, that works perfectly."</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                      <div className="p-2 bg-green-50 rounded-lg text-green-600">
                        <Mail className="w-5 h-5" />
                      </div>
                      Instant Follow-up
                    </h3>
                    <div className="flex items-center gap-3 p-3 bg-green-50/50 rounded-lg border border-green-100">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="text-sm">
                        <p className="text-gray-900 font-medium">Appointment Confirmed</p>
                        <p className="text-gray-500">Confirmation & instructions sent via SMS</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-8 w-full max-w-5xl pt-16 border-t border-gray-100 mt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            {STATS.map((stat, index) => (
              <AnimatedStat
                key={index}
                value={stat.value}
                label={stat.label}
                suffix={stat.suffix}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
