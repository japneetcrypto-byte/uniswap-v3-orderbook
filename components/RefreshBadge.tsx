"use client";

import { useEffect, useState } from "react";

interface RefreshBadgeProps {
  lastUpdated: number | null;
  onRefresh: () => void;
  onCooldownComplete: () => void;
  loading?: boolean;
  mode: "simple" | "advanced";
}

export function RefreshBadge({ 
  lastUpdated, 
  onRefresh, 
  onCooldownComplete,
  loading, 
  mode 
}: RefreshBadgeProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>("Never");
  const [canRefresh, setCanRefresh] = useState<boolean>(true);

  const COOLDOWN_PERIOD = mode === "advanced" ? 120 : 60;

  useEffect(() => {
    if (!lastUpdated) {
      setTimeAgo("Never");
      setCountdown(null);
      setCanRefresh(true);
      return;
    }

    const updateTimeAgo = () => {
      const now = Date.now();
      const diff = Math.floor((now - lastUpdated) / 1000);
      
      if (diff < 60) {
        setTimeAgo(`${diff}s ago`);
      } else if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        setTimeAgo(`${minutes}m ago`);
      } else {
        const hours = Math.floor(diff / 3600);
        setTimeAgo(`${hours}h ago`);
      }

      const remaining = Math.max(0, COOLDOWN_PERIOD - diff);
      setCountdown(remaining > 0 ? remaining : null);
      
      const canRefreshNow = diff >= COOLDOWN_PERIOD;
      setCanRefresh(canRefreshNow);
      
      // ✅ Notify parent when cooldown completes
      if (canRefreshNow && remaining === 0 && diff === COOLDOWN_PERIOD) {
        onCooldownComplete();
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000);

    return () => clearInterval(interval);
  }, [lastUpdated, COOLDOWN_PERIOD, onCooldownComplete]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleRefreshClick = () => {
    if (canRefresh && !loading) {
      onRefresh();
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-6 text-sm text-gray-600">
        <div>
          <span className="font-medium">Mode:</span>{" "}
          <span className={`font-semibold ${mode === "advanced" ? "text-blue-600" : "text-green-600"}`}>
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </span>
        </div>
        <div>
          <span className="font-medium">Last Updated</span>{" "}
          {lastUpdated ? formatTime(lastUpdated) : "Never"}
        </div>
        <div>
          <span className="font-medium">Refreshes in</span>{" "}
          {countdown !== null && countdown > 0 ? `${countdown}s` : "—"}
        </div>
      </div>
      
      <button
        onClick={handleRefreshClick}
        disabled={loading || !canRefresh}
        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
          loading || !canRefresh
            ? "bg-gray-400 text-gray-200 cursor-not-allowed"
            : "bg-gray-600 text-white hover:bg-gray-700"
        }`}
        title={
          !canRefresh && countdown 
            ? `Please wait ${countdown}s before refreshing` 
            : loading 
            ? "Refreshing..." 
            : "Refresh now"
        }
      >
        {loading ? "Refreshing..." : !canRefresh && countdown ? `Wait ${countdown}s` : "Refresh Now"}
      </button>
    </div>
  );
}
