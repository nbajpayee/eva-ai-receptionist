"use client";

import { motion } from "framer-motion";
import { format } from "date-fns";
import { Calendar, Clock, Sun, Moon, Coffee } from "lucide-react";
import { GoalProgressRing } from "./goal-progress-ring";
import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  userName?: string;
  appointmentsToday: number;
  nextAppointment?: {
    customer: string;
    time: Date;
    service: string;
  };
  dailyGoal: {
    current: number;
    target: number;
    label: string;
  };
}

export function HeroSection({
  userName = "Dr. Smith",
  appointmentsToday,
  nextAppointment,
  dailyGoal,
}: HeroSectionProps) {
  const hour = new Date().getHours();
  
  let greeting = "Good evening";
  let Icon = Moon;
  let contextMode: "morning" | "day" | "evening" = "day";

  if (hour < 12) {
    greeting = "Good morning";
    Icon = Coffee;
    contextMode = "morning";
  } else if (hour < 18) {
    greeting = "Good afternoon";
    Icon = Sun;
    contextMode = "day";
  } else {
    contextMode = "evening";
  }

  const progress = Math.min((dailyGoal.current / dailyGoal.target) * 100, 100);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-8 text-white shadow-2xl"
    >
      {/* Background Decor */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        {/* Left Content */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-indigo-100">
            <Icon className="h-5 w-5" />
            <span className="text-sm font-medium uppercase tracking-wider">{format(new Date(), "EEEE, MMMM do")}</span>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">
              {greeting}, {userName}
            </h1>
            <p className="max-w-md text-lg text-indigo-100">
              {contextMode === "morning" && `You have ${appointmentsToday} appointments scheduled for today.`}
              {contextMode === "day" && "Eva is handling your communications while you work."}
              {contextMode === "evening" && "Here is how your practice performed today."}
            </p>
          </div>

          {nextAppointment && contextMode !== "evening" && (
            <div className="mt-6 flex items-center gap-4 rounded-xl bg-white/10 p-4 backdrop-blur-md border border-white/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-indigo-200 uppercase tracking-wide">Up Next</p>
                <p className="font-semibold">{nextAppointment.customer} - {nextAppointment.service}</p>
                <div className="flex items-center gap-1 text-sm text-indigo-100">
                  <Clock className="h-3 w-3" />
                  {format(nextAppointment.time, "h:mm a")}
                </div>
              </div>
              <div className="ml-auto">
                <Button variant="secondary" size="sm" className="bg-white text-indigo-600 hover:bg-indigo-50">
                  View
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Content - KPI Ring */}
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl bg-white/5 p-6 backdrop-blur-sm border border-white/10">
          <GoalProgressRing 
            progress={progress} 
            size={140} 
            strokeWidth={12} 
            color="#fff" 
            trackColor="rgba(255,255,255,0.2)"
            label={`${Math.round(progress)}%`}
            sublabel="of Daily Goal"
          />
          <div className="text-center">
            <p className="text-sm font-medium text-indigo-100">{dailyGoal.label}</p>
            <p className="text-2xl font-bold">{dailyGoal.current} / {dailyGoal.target}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

