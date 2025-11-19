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
  const evaMonthlyCost = 599; // Professional plan
  const evaAnnualCost = evaMonthlyCost * 12;
  const capturedCalls = missedCallsPerYear * 0.95; // Eva captures 95%
  const additionalRevenue = capturedCalls * avgAppointmentValue * 0.6;
  const netBenefit = additionalRevenue - evaAnnualCost;
  const roi = ((netBenefit / evaAnnualCost) * 100).toFixed(0);

  return (
    <FadeInUp>
      <div className="bg-gradient-to-br from-primary-50 to-white rounded-2xl p-8 border border-primary-100">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Calculate Your ROI
        </h3>

        <div className="space-y-6">
          {/* Inputs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Calls per day: <span className="font-bold">{callsPerDay}</span>
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
              Average appointment value: <span className="font-bold">{formatCurrency(avgAppointmentValue)}</span>
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
              Current missed call rate: <span className="font-bold">{missedCallRate}%</span>
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
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Lost revenue per year:</span>
              <span className="text-xl font-bold text-red-600">
                {formatCurrency(lostRevenuePerYear)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-700">Eva annual cost:</span>
              <span className="text-xl font-bold text-gray-900">
                {formatCurrency(evaAnnualCost)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-700">Additional revenue captured:</span>
              <span className="text-xl font-bold text-green-600">
                +{formatCurrency(additionalRevenue)}
              </span>
            </div>

            <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-6 mt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-primary-100 text-sm mb-1">Net Annual Benefit</p>
                  <p className="text-3xl font-bold text-white">
                    {formatCurrency(netBenefit)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-primary-100 text-sm mb-1">ROI</p>
                  <p className="text-3xl font-bold text-white">
                    {roi}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600 mt-6 text-center">
          *Estimates based on 60% booking conversion rate and 95% call capture with Eva
        </p>
      </div>
    </FadeInUp>
  );
}
