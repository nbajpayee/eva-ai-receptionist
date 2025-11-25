"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Settings2 } from "lucide-react";

export type VADMode = "rms" | "silero" | "hybrid";

interface VADSettingsProps {
  vadEnabled: boolean;
  vadThreshold: number;
  vadMode?: VADMode;
  onVadEnabledChange: (enabled: boolean) => void;
  onVadThresholdChange: (threshold: number) => void;
  onVadModeChange?: (mode: VADMode) => void;
}

export function VADSettings({
  vadEnabled,
  vadThreshold,
  vadMode = "rms",
  onVadEnabledChange,
  onVadThresholdChange,
  onVadModeChange,
}: VADSettingsProps) {
  return (
    <Card className="border-zinc-200 bg-white/80 backdrop-blur-sm shadow-sm">
      <CardHeader className="border-b border-zinc-100 bg-zinc-50/50 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-zinc-500" />
            <CardTitle className="text-base font-semibold text-zinc-900">Voice Activity Detection</CardTitle>
          </div>
          <Badge variant="outline" className="bg-white text-xs font-normal">
            Advanced
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* VAD Enable/Disable */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="vad-enabled" className="text-zinc-900">Enable VAD</Label>
            <p className="text-xs text-zinc-500">
              Automatically detect when you start and stop speaking
            </p>
          </div>
          <Switch
            id="vad-enabled"
            checked={vadEnabled}
            onCheckedChange={onVadEnabledChange}
          />
        </div>

        {vadEnabled && (
          <>
            {/* VAD Mode Selection */}
            {onVadModeChange && (
              <div className="space-y-2">
                <Label htmlFor="vad-mode" className="text-zinc-900">Detection Mode</Label>
                <Select value={vadMode} onValueChange={onVadModeChange}>
                  <SelectTrigger id="vad-mode" className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rms">
                      RMS (Fast, 70-80% accuracy)
                    </SelectItem>
                    <SelectItem value="silero">
                      Silero ML (Accurate, 95%+ accuracy)
                    </SelectItem>
                    <SelectItem value="hybrid">
                      Hybrid (Best of both)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-xs text-sky-900 border border-sky-100">
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-sky-600" />
                  <div className="space-y-1">
                    <p className="font-medium text-sky-800">Mode Comparison:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-1 text-sky-700">
                      <li><strong>RMS:</strong> Simple volume-based detection. Fast but less accurate.</li>
                      <li><strong>Silero:</strong> ML-powered detection. Highly accurate, slight overhead.</li>
                      <li><strong>Hybrid:</strong> Uses RMS as pre-filter, Silero for confirmation.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Threshold Slider (only for RMS and Hybrid modes) */}
            {(vadMode === "rms" || vadMode === "hybrid") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="vad-threshold" className="text-zinc-900">Sensitivity Threshold</Label>
                  <span className="font-mono text-xs text-zinc-500">{vadThreshold.toFixed(4)}</span>
                </div>
                <Slider
                  id="vad-threshold"
                  min={0.001}
                  max={0.02}
                  step={0.001}
                  value={[vadThreshold]}
                  onValueChange={([value]) => onVadThresholdChange(value)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-zinc-400">
                   <span>More Sensitive</span>
                   <span>Less Sensitive</span>
                </div>
              </div>
            )}

            {/* Accuracy Benchmark */}
            <div className="space-y-2">
              <Label className="text-zinc-900">Expected Accuracy</Label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-100">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-500 transition-all duration-500"
                      style={{
                        width: vadMode === "rms" ? "75%" : vadMode === "silero" ? "95%" : "90%",
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium text-zinc-700 w-12 text-right font-mono">
                  {vadMode === "rms" ? "75%" : vadMode === "silero" ? "95%" : "90%"}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
