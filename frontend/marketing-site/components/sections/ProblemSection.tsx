"use client";

import { useState } from "react";
import FadeInUp from "@/components/animations/FadeInUp";
import { PhoneOff, Clock, UserX } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function ProblemSection() {
  const problems = [
    {
      icon: PhoneOff,
      title: "Calls going to voicemail",
      description: "During rush hours, potential patients hang up when they can't reach a live person",
    },
    {
      icon: UserX,
      title: "Staff overwhelmed",
      description: "Your team is buried in repetitive booking questions instead of helping in-person clients",
    },
    {
      icon: Clock,
      title: "24/7 expectations",
      description: "Patients want to book at 9 PM on Sunday, but you're only available 9-5 weekdays",
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
  const capturedCalls = missedCallsPerYear * 0.95;
  const potentialRecovery = capturedCalls * avgAppointmentValue * 0.6;

  return (
    <section className="section-spacing bg-white">
      <div className="container-wide">
        <FadeInUp className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="heading-lg text-gray-900 mb-4">
            Every Missed Call is Lost Revenue
          </h2>
          <p className="text-xl text-gray-600">
            The average medical spa loses <span className="font-bold text-primary-600">$50,000/year</span> to missed calls and inefficient scheduling.
          </p>
        </FadeInUp>

        <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto items-start">
          {/* Left side - Problem points */}
          <div className="space-y-8">
            {problems.map((problem, index) => (
              <FadeInUp key={index} delay={index * 0.1}>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                    <problem.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {problem.title}
                    </h3>
                    <p className="text-gray-600">
                      {problem.description}
                    </p>
                  </div>
                </div>
              </FadeInUp>
            ))}
          </div>

          {/* Right side - Compact ROI Calculator */}
          <FadeInUp delay={0.3}>
            <div className="bg-gradient-to-br from-primary-50 to-white rounded-2xl p-6 border border-primary-100 shadow-lg sticky top-24">
              <h3 className="text-lg font-bold text-gray-900 mb-1 text-center">
                Calculate Your Lost Revenue
              </h3>
              <p className="text-sm text-gray-600 text-center mb-6">
                See what missed calls are costing you
              </p>

              <div className="space-y-4">
                {/* Inputs - Compact version */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Calls per day: <span className="font-bold text-primary-600">{callsPerDay}</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={callsPerDay}
                    onChange={(e) => setCallsPerDay(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Avg appointment value: <span className="font-bold text-primary-600">{formatCurrency(avgAppointmentValue)}</span>
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="1000"
                    step="50"
                    value={avgAppointmentValue}
                    onChange={(e) => setAvgAppointmentValue(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Missed call rate: <span className="font-bold text-primary-600">{missedCallRate}%</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={missedCallRate}
                    onChange={(e) => setMissedCallRate(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                </div>

                {/* Results - Compact version */}
                <div className="pt-4 border-t-2 border-primary-200 space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-red-900 text-xs font-medium mb-1">Revenue Lost Annually</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(lostRevenuePerYear)}
                    </p>
                    <p className="text-red-700 text-xs mt-1">
                      From {Math.round(missedCallsPerYear).toLocaleString()} missed calls
                    </p>
                  </div>

                  <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4">
                    <p className="text-green-100 text-xs font-medium mb-1">Potential Recovery</p>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(potentialRecovery)}
                    </p>
                    <p className="text-green-100 text-xs mt-1">
                      By capturing 95% of opportunities
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-600 mt-4 text-center">
                *Based on 60% booking conversion rate
              </p>
            </div>
          </FadeInUp>
        </div>
      </div>
    </section>
  );
}
