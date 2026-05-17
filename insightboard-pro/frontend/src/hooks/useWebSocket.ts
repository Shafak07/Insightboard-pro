"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getWebSocketUrl } from "@/lib/live";

export type WsConnectionState = "connected" | "reconnecting" | "disconnected";

export type WsMessage = {
  type: string;
  [key: string]: unknown;
};

type MessageHandler = (message: WsMessage) => void;

const MAX_BACKOFF_MS = 30_000;

export function useWebSocket(
  userId: string | null,
  token: string | null,
  enabled = true
) {
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] =
    useState<WsConnectionState>("disconnected");

  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalClose = useRef(false);

  const on = useCallback((type: string, handler: MessageHandler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  const dispatch = useCallback((message: WsMessage) => {
    setLastMessage(message);
    const handlers = handlersRef.current.get(message.type);
    handlers?.forEach((h) => h(message));
    const all = handlersRef.current.get("*");
    all?.forEach((h) => h(message));
  }, []);

  const sendMessage = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (!userId || !token || !enabled) return;

    intentionalClose.current = false;
    setConnectionState(reconnectAttempt.current > 0 ? "reconnecting" : "disconnected");

    const url = getWebSocketUrl(userId, token);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempt.current = 0;
      setIsConnected(true);
      setConnectionState("connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage;
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        dispatch(data);
      } catch {
        /* ignore malformed */
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      if (intentionalClose.current || !enabled) {
        setConnectionState("disconnected");
        return;
      }
      setConnectionState("reconnecting");
      const delay = Math.min(
        1000 * 2 ** reconnectAttempt.current,
        MAX_BACKOFF_MS
      );
      reconnectAttempt.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [userId, token, enabled, dispatch]);

  useEffect(() => {
    if (!userId || !token || !enabled) {
      intentionalClose.current = true;
      wsRef.current?.close();
      setIsConnected(false);
      setConnectionState("disconnected");
      return;
    }

    connect();

    return () => {
      intentionalClose.current = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [userId, token, enabled, connect]);

  return {
    lastMessage,
    sendMessage,
    isConnected,
    connectionState,
    /** Register a handler by message type (handler map). */
    on,
    registerHandler: on,
  };
}
