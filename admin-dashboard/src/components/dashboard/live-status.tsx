"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Phone, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActiveCall {
  id: number;
  session_id: string;
  phone_number?: string;
  started_at?: string;
  customer_id?: number;
}

interface RecentActivity {
  id: number;
  session_id: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  outcome?: string;
}

interface LiveStatusData {
  active_websocket_count: number;
  active_session_ids: string[];
  active_calls: ActiveCall[];
  recent_activity: RecentActivity[];
}

const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds

export function LiveStatus() {
  const [data, setData] = useState<LiveStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/admin/live-status");

        if (!response.ok) {
          throw new Error("Failed to fetch live status");
        }

        const newData = await response.json();
        setData(newData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll for updates
    const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 animate-pulse" />
            Live Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Live Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const hasActiveCalls = (data?.active_calls?.length ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className={`h-5 w-5 ${hasActiveCalls ? 'text-green-600 animate-pulse' : ''}`} />
          Live Status
          {hasActiveCalls && (
            <Badge variant="default" className="ml-2 bg-green-600">
              {data?.active_calls?.length} Active
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Real-time call activity monitor</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Calls Section */}
        {hasActiveCalls ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-900">Active Calls</h4>
            <div className="space-y-2">
              {data?.active_calls?.map((call) => (
                <div
                  key={call.session_id}
                  className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3"
                >
                  <Phone className="h-4 w-4 text-green-600 animate-pulse" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-900">
                      {call.phone_number || "Unknown"}
                    </p>
                    {call.started_at && (
                      <p className="text-xs text-zinc-500">
                        Started {formatDistanceToNow(new Date(call.started_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs border-green-600 text-green-600">
                    In Progress
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center">
            <p className="text-sm text-zinc-500">No active calls</p>
          </div>
        )}

        {/* Recent Activity Section */}
        {data?.recent_activity && data.recent_activity.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-900">Recent Activity</h4>
            <div className="space-y-1">
              {data.recent_activity.slice(0, 5).map((activity) => (
                <div
                  key={activity.session_id}
                  className="flex items-center gap-2 text-xs text-zinc-600"
                >
                  <Clock className="h-3 w-3" />
                  <span>
                    {activity.ended_at
                      ? `Ended ${formatDistanceToNow(new Date(activity.ended_at), { addSuffix: true })}`
                      : activity.started_at
                      ? `Started ${formatDistanceToNow(new Date(activity.started_at), { addSuffix: true })}`
                      : "Unknown"}
                  </span>
                  {activity.outcome && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {activity.outcome}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WebSocket Connections Info */}
        <div className="pt-2 border-t border-zinc-200">
          <p className="text-xs text-zinc-500">
            {data?.active_websocket_count ?? 0} active connection{data?.active_websocket_count !== 1 ? 's' : ''}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
