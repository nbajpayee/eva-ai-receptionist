"use client";

import { useState } from "react";
import FadeInUp from "@/components/animations/FadeInUp";
import { PhoneOff, Clock, UserX, Calculator } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function ProblemSection() {
  const problems = [
    {
      icon: PhoneOff,
      title: "Calls going to voicemail",
      description: "During rush hours, potential patients hang up when they can't reach a live person.",
    },
    {
      icon: UserX,
      title: "Staff overwhelmed",
      description: "Your team is buried in repetitive booking questions instead of helping in-person clients.",
    },
    {
      icon: Clock,
      title: "24/7 expectations",
      description: "Patients want to book at 9 PM on Sunday, but you're only available 9-5 weekdays.",
    },
  ];

  // ROI Calculator state
  const [callsPerDay, setCallsPerDay] = useState(20);
  const [avgAppointmentValue, setAvgAppointmentValue] = useState(300);
  const [missedCallRate, setMissedCallRate] = useState(25);

  // Calculations
  const callsPerYear = callsPerDay * 365;
  const missedCallsPerYear = (callsPerYear * missedCallRate) / 100;
  const lostRevenuePerYear = missedCallsPerYear * avgAppointmentValue * 0.6;

  return (
    <section className="section-spacing bg-white overflow-hidden">
      <div className="container-wide">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-start">
          {/* Left side - Header & Problem points (40-ish% width -> 5/12 cols) */}
          <div className="lg:col-span-5 space-y-12">
            <FadeInUp>
              <div className="space-y-6">
                <h2 className="heading-lg text-gray-900">
                  Every Missed Call is <span className="text-red-600">Lost Revenue</span>
                </h2>
                <p className="text-xl text-gray-600 leading-relaxed">
                  The average medical spa loses <span className="font-bold text-gray-900">&gt;$300K/year</span> to missed calls and inefficient scheduling. Don&apos;t let revenue walk out the door.
                </p>
              </div>
            </FadeInUp>

            <div className="space-y-8 relative">
              {/* Connecting line for timeline effect */}
              <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gray-100 hidden md:block" />

              {problems.map((problem, index) => (
                <FadeInUp key={index} delay={index * 0.1 + 0.2}>
                  <div className="flex gap-6 relative">
                    <div className="flex-shrink-0 w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center z-10 shadow-sm">
                      <problem.icon className="w-5 h-5" />
                    </div>
                    <div className="pt-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {problem.title}
                      </h3>
                      <p className="text-gray-600 leading-relaxed">
                        {problem.description}
                      </p>
                    </div>
                  </div>
                </FadeInUp>
              ))}
            </div>
            
            {/* Mobile only CTA */}
            <div className="lg:hidden">
               <button className="w-full bg-primary-600 text-white font-semibold py-4 px-8 rounded-xl shadow-lg shadow-primary-600/20">
                  Calculate Your Recovery
               </button>
            </div>
          </div>

          {/* Right side - Interactive ROI Calculator (60-ish% width -> 7/12 cols) */}
          <div className="lg:col-span-7 sticky top-8">
            <FadeInUp delay={0.4}>
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 p-6 border-b border-gray-100 flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Calculator className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">
                      Lost Revenue Calculator
                    </h3>
                    <p className="text-sm text-gray-500">
                      Estimate your potential growth with Eva
                    </p>
                  </div>
                </div>

                <div className="p-6 lg:p-8 space-y-8">
                  {/* Sliders */}
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Average Calls Per Day</label>
                        <span className="text-sm font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-full">{callsPerDay}</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="100"
                        value={callsPerDay}
                        onChange={(e) => setCallsPerDay(Number(e.target.value))}
                        className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary-600 hover:accent-primary-700 transition-colors"
                      />
                      <div className="flex justify-between mt-1 text-xs text-gray-400">
                        <span>5</span>
                        <span>100</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Avg. Appointment Value</label>
                        <span className="text-sm font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-full">{formatCurrency(avgAppointmentValue)}</span>
                      </div>
                      <input
                        type="range"
                        min="100"
                        max="1000"
                        step="50"
                        value={avgAppointmentValue}
                        onChange={(e) => setAvgAppointmentValue(Number(e.target.value))}
                        className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary-600 hover:accent-primary-700 transition-colors"
                      />
                      <div className="flex justify-between mt-1 text-xs text-gray-400">
                        <span>$100</span>
                        <span>$1,000</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Missed Call Rate</label>
                        <span className="text-sm font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-full">{missedCallRate}%</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        value={missedCallRate}
                        onChange={(e) => setMissedCallRate(Number(e.target.value))}
                        className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary-600 hover:accent-primary-700 transition-colors"
                      />
                      <div className="flex justify-between mt-1 text-xs text-gray-400">
                        <span>5%</span>
                        <span>50%</span>
                      </div>
                    </div>
                  </div>

                  {/* Results - Full width Revenue Lost */}
                  <div className="bg-red-50 rounded-2xl p-6 border border-red-200 text-center transition-transform hover:scale-[1.02]">
                    <p className="text-red-900 text-sm font-medium mb-2">Revenue Lost Annually</p>
                    <p className="text-4xl lg:text-5xl font-bold text-red-600 mb-2">
                      {formatCurrency(lostRevenuePerYear)}
                    </p>
                    <p className="text-red-700 text-sm mt-2">
                      From {Math.round(missedCallsPerYear).toLocaleString()} missed calls per year
                    </p>
                  </div>

                  <p className="text-xs text-center text-gray-400 mt-2">
                    *Estimates based on 60% booking conversion rate. Industry average missed call rate is 20-30%.
                  </p>
                </div>
              </div>
            </FadeInUp>
          </div>
        </div>
      </div>
    </section>
  );
}
