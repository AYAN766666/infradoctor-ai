"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { WsClient } from "@/lib/ws";

interface UseWebSocketOptions {
  onMetrics?: (data: any) => void;
  onAlerts?: (data: any) => void;
  onProjects?: (data: any) => void;
  enabled?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const clientRef = useRef<WsClient | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (options.enabled === false) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const host = apiUrl.replace(/^https?:\/\//, "") || "localhost:8000";
    const url = `${protocol}://${host}`;

    const client = new WsClient({
      url,
      token,
      onMessage: (msg) => {
        switch (msg.type) {
          case "metrics":
            options.onMetrics?.(msg.data);
            break;
          case "alerts":
            options.onAlerts?.({ project_id: msg.project_id, data: msg.data });
            break;
          case "projects":
            options.onProjects?.(msg.data);
            break;
        }
      },
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
    });

    client.connect();
    clientRef.current = client;

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [options.enabled]);

  const send = useCallback((data: any) => {
    clientRef.current?.send(data);
  }, []);

  return { connected, send };
}
