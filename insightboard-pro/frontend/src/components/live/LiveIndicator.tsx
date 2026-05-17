"use client";

import { useWebSocketContext } from "@/providers/websocket-provider";
import { cn } from "@/lib/utils";

const LABELS = {
  connected: "Live data connected",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
} as const;

export function LiveIndicator({ className }: { className?: string }) {
  const { connectionState } = useWebSocketContext();
  const label = LABELS[connectionState];

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      title={label}
      aria-label={label}
      role="status"
    >
      <span
        className={cn(
          "relative inline-flex h-2.5 w-2.5 rounded-full",
          connectionState === "connected" && "bg-emerald-500",
          connectionState === "reconnecting" && "bg-amber-500",
          connectionState === "disconnected" && "bg-red-500"
        )}
      >
        {connectionState === "connected" ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        ) : null}
      </span>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {label}
      </span>
    </div>
  );
}

