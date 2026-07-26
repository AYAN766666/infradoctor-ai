"use client";

import { useEffect, useState, useRef } from "react";
import { Bot, Users, MessageSquare, Eye, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://infradoctor-backend.vercel.app";

interface AgentStats {
  active_users: number;
  today_chats: number;
  today_visitors: number;
  page_breakdown: Record<string, number>;
}

interface AgentAnalyticsCardProps {
  theme?: string;
}

export function AgentAnalyticsCard({ theme = "dark" }: AgentAnalyticsCardProps) {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/ai/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    pollRef.current = setInterval(fetchStats, 15000);
    return () => clearInterval(pollRef.current);
  }, []);

  if (loading) return null;

  const items = [
    {
      icon: <Bot size={22} />,
      label: "Active Now",
      value: stats?.active_users ?? 0,
      color: "emerald",
      suffix: stats?.active_users === 1 ? "person" : "people",
    },
    {
      icon: <MessageSquare size={22} />,
      label: "Today's Chats",
      value: stats?.today_chats ?? 0,
      color: "indigo",
      suffix: stats?.today_chats === 1 ? "chat" : "chats",
    },
    {
      icon: <Eye size={22} />,
      label: "Today's Visitors",
      value: stats?.today_visitors ?? 0,
      color: "violet",
      suffix: stats?.today_visitors === 1 ? "visit" : "visits",
    },
  ];

  const colorMap: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    emerald: {
      bg: theme === "light" ? "bg-emerald-50" : "bg-emerald-500/10",
      border: theme === "light" ? "border-emerald-200" : "border-emerald-500/20",
      text: "text-emerald-500",
      dot: "bg-emerald-400",
    },
    indigo: {
      bg: theme === "light" ? "bg-indigo-50" : "bg-indigo-500/10",
      border: theme === "light" ? "border-indigo-200" : "border-indigo-500/20",
      text: "text-indigo-500",
      dot: "bg-indigo-400",
    },
    violet: {
      bg: theme === "light" ? "bg-violet-50" : "bg-violet-500/10",
      border: theme === "light" ? "border-violet-200" : "border-violet-500/20",
      text: "text-violet-500",
      dot: "bg-violet-400",
    },
  };

  return (
    <div className={cn(
      "rounded-2xl border p-5 transition-colors",
      theme === "light" ? "bg-white border-slate-200 shadow-sm" : "bg-neutral-900/50 border-white/5"
    )}>
      <div className="flex items-center gap-2 mb-4">
        <Activity size={18} className="text-indigo-500" />
        <h3 className={cn("text-sm font-bold tracking-tight", theme === "light" ? "text-slate-800" : "text-white")}>
          AI Agent Activity
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((item) => {
          const c = colorMap[item.color];
          return (
            <div key={item.label} className={cn("rounded-xl border p-4 flex items-center gap-3", c.bg, c.border)}>
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", c.bg, c.border)}>
                <span className={c.text}>{item.icon}</span>
              </div>
              <div>
                <div className={cn("text-2xl font-bold tracking-tight", c.text)}>
                  {item.value}
                  {item.label === "Active Now" && item.value > 0 && (
                    <span className={cn("inline-block w-2 h-2 ml-2 rounded-full animate-pulse", c.dot)} />
                  )}
                </div>
                <div className={cn("text-xs mt-0.5", theme === "light" ? "text-slate-500" : "text-neutral-500")}>
                  {item.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
