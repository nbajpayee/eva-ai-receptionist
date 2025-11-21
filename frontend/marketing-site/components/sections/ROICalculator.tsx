"use client";

import { useState } from "react";
import FadeInUp from "@/components/animations/FadeInUp";
import { formatCurrency } from "@/lib/utils";

export default function ROICalculator() {
  const [callsPerDay, setCallsPerDay] = useState(20);
  const [avgAppointmentValue, setAvgAppointmentValue] = useState(300);
  const [missedCallRate, setMissedCallRate] = useState(25);

  // Calculations
  const callsPerYear = callsPerDay * 365;
  const missedCallsPerYear = (callsPerYear * missedCallRate) / 100;
  const lostRevenuePerYear = missedCallsPerYear * avgAppointmentValue * 0.6; // 60% conversion rate
  const capturedCalls = missedCallsPerYear * 0.95; // Eva captures 95%
  const potentialRecovery = capturedCalls * avgAppointmentValue * 0.6;

  return (
    <FadeInUp>
      <div className="bg-gradient-to-br from-primary-50 to-white rounded-2xl p-8 border border-primary-100 shadow-lg">
        <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Calculate Your Cost of Missed Calls
        </h3>
        <p className="text-gray-600 text-center mb-6">
          See how much revenue you&apos;re leaving on the table
        </p>

        <div className="space-y-6">
          {/* Inputs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Average appointment value: <span className="font-bold text-primary-600">{formatCurrency(avgAppointmentValue)}</span>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current missed call rate: <span className="font-bold text-primary-600">{missedCallRate}%</span>
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

          {/* Results */}
          <div className="pt-6 border-t-2 border-primary-200 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <p className="text-red-900 text-sm font-medium mb-2">Revenue Lost Annually</p>
              <p className="text-4xl font-bold text-red-600">
                {formatCurrency(lostRevenuePerYear)}
              </p>
              <p className="text-red-700 text-sm mt-2">
                From {Math.round(missedCallsPerYear).toLocaleString()} missed calls per year
              </p>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6">
              <p className="text-green-100 text-sm font-medium mb-2">Potential Annual Recovery</p>
              <p className="text-4xl font-bold text-white">
                {formatCurrency(potentialRecovery)}
              </p>
              <p className="text-green-100 text-sm mt-2">
                By capturing 95% of missed opportunities
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600 mt-6 text-center">
          *Estimates based on 60% booking conversion rate. Industry average missed call rate is 20-30%.
        </p>
      </div>
    </FadeInUp>
  );
}
