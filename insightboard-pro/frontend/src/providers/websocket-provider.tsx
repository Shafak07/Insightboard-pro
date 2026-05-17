"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  useWebSocket,
  type WsConnectionState,
  type WsMessage,
} from "@/hooks/useWebSocket";
import { createClient } from "@/lib/supabase/client";
import { useDashboardLiveStore } from "@/store/dashboard-live-store";
import { useUploadProgressStore } from "@/store/upload-progress-store";

interface WebSocketContextValue {
  isConnected: boolean;
  connectionState: WsConnectionState;
  lastMessage: WsMessage | null;
  sendMessage: (msg: object) => void;
  on: (type: string, handler: (message: WsMessage) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const setUploadProgress = useUploadProgressStore((s) => s.setProgress);
  const setViewerCount = useDashboardLiveStore((s) => s.setViewerCount);

  useEffect(() => {
    const client = createClient();
    const load = async () => {
      const {
        data: { session },
      } = await client.auth.getSession();
      setUserId(session?.user?.id ?? null);
      setToken(session?.access_token ?? null);
    };
    void load();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setToken(session?.access_token ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const ws = useWebSocket(userId, token, Boolean(userId && token));

  useEffect(() => {
    return ws.on("dataset_ready", () => {
      void queryClient.invalidateQueries({ queryKey: ["datasets"] });
    });
  }, [ws, queryClient]);

  useEffect(() => {
    return ws.on("processing_progress", (msg) => {
      const datasetId = String(msg.dataset_id ?? "");
      const percent = Number(msg.percent ?? 0);
      const stage = String(msg.stage ?? "");
      if (datasetId) {
        setUploadProgress(datasetId, percent, stage);
      }
    });
  }, [ws, setUploadProgress]);

  useEffect(() => {
    return ws.on("dashboard_view", (msg) => {
      const dashboardId = String(msg.dashboard_id ?? "");
      const count = Number(msg.viewer_count ?? 0);
      if (dashboardId) {
        setViewerCount(dashboardId, count);
      }
    });
  }, [ws, setViewerCount]);

  const value = useMemo(
    () => ({
      isConnected: ws.isConnected,
      connectionState: ws.connectionState,
      lastMessage: ws.lastMessage,
      sendMessage: ws.sendMessage,
      on: ws.on,
    }),
    [ws]
  );

  return (
    <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocketContext must be used within WebSocketProvider");
  }
  return ctx;
}
