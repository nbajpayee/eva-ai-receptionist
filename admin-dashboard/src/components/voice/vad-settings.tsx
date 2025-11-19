"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info } from "lucide-react";

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Voice Activity Detection (VAD)
          <Badge variant="secondary" className="text-xs">
            Advanced
          </Badge>
        </CardTitle>
        <CardDescription>
          Configure how the system detects when you're speaking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* VAD Enable/Disable */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="vad-enabled">Enable VAD</Label>
            <p className="text-sm text-zinc-500">
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
                <Label htmlFor="vad-mode">Detection Mode</Label>
                <Select value={vadMode} onValueChange={onVadModeChange}>
                  <SelectTrigger id="vad-mode">
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
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium">Mode Comparison:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="vad-threshold">Sensitivity Threshold</Label>
                  <span className="text-sm text-zinc-500">{vadThreshold.toFixed(4)}</span>
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
                <p className="text-xs text-zinc-500">
                  Lower values = more sensitive (may pick up background noise)
                  <br />
                  Higher values = less sensitive (may miss quiet speech)
                </p>
              </div>
            )}

            {/* Accuracy Benchmark */}
            <div className="space-y-2">
              <Label>Expected Accuracy</Label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-green-500 transition-all"
                      style={{
                        width: vadMode === "rms" ? "75%" : vadMode === "silero" ? "95%" : "90%",
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium text-zinc-700 w-12">
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
