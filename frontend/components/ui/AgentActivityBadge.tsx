"use client";

import { useEffect, useState, useRef } from "react";
import { Bot, Users } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://infradoctor-backend.vercel.app";

interface AgentActivityBadgeProps {
  theme?: string;
}

export function AgentActivityBadge({ theme = "dark" }: AgentActivityBadgeProps) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useWebSocket({
    onAgentCount: (c) => {
      setCount(c);
      setLoading(false);
    },
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_BASE}/ai/active`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.active_users === "number") {
          setCount(d.active_users);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    pollRef.current = setInterval(() => {
      fetch(`${API_BASE}/ai/active`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && typeof d.active_users === "number") {
            setCount(d.active_users);
          }
        })
        .catch(() => {});
    }, 15000);

    return () => clearInterval(pollRef.current);
  }, []);

  if (loading) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border transition-all",
        count > 0
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          : "bg-zinc-800/80 border-zinc-700/50 text-zinc-400"
      )}
    >
      <div className="relative">
        <Bot size={16} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        )}
      </div>
      <span className={cn("text-xs font-medium", count > 0 && "text-emerald-400")}>
        {count > 0
          ? `${count} ${count === 1 ? "person" : "people"} chatting with AI`
          : "AI agent idle"}
      </span>
      {count > 0 && (
        <Users size={14} className="text-emerald-400/70" />
      )}
    </div>
  );
}
