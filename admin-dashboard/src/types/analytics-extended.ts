export interface DailyMetric {
  date: string;
  total_calls: number;
  appointments_booked: number;
  avg_satisfaction_score: number;
  conversion_rate: number;
  avg_call_duration_minutes: number;
}

export interface FunnelStage {
  name: string;
  value: number;
  color: string;
}

export interface FunnelData {
  period: string;
  stages: FunnelStage[];
}

export interface HeatmapPoint {
  day: number; // 0-6 (Sun-Sat)
  hour: number; // 0-23
  value: number;
}

export interface ChannelMetric {
  name: string;
  conversations: number;
  color: string;
}

export interface OutcomeMetric {
  name: string;
  count: number;
  color: string;
}

export interface TimeSeriesPoint {
  timestamp: string;
  total_calls: number;
  appointments_booked: number;
  avg_satisfaction_score: number;
}

export type Period = "today" | "week" | "month";


