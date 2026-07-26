"use client";

import { useEffect, useState } from "react";
import { Users, LogIn, UserPlus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://infradoctor-backend.vercel.app";

interface LoginEvent {
  name: string;
  action: string;
  time: string;
  date: string;
}

interface LoginActivityCardProps {
  theme?: string;
}

export function LoginActivityCard({ theme = "dark" }: LoginActivityCardProps) {
  const [data, setData] = useState<{ today_count: number; recent: LoginEvent[] } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_BASE}/auth/activity`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <div className={cn(
      "rounded-2xl border p-5 mb-6 transition-colors",
      theme === "light" ? "bg-white border-slate-200 shadow-sm" : "bg-neutral-900/50 border-white/5"
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-indigo-500" />
          <h3 className={cn("text-sm font-bold tracking-tight", theme === "light" ? "text-slate-800" : "text-white")}>
            Today's Activity
          </h3>
        </div>
        <span className="text-2xl font-black text-indigo-400">{data.today_count}</span>
      </div>

      <div className="space-y-2">
        {data.recent.map((e, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
              theme === "light" ? "hover:bg-slate-50" : "hover:bg-white/5"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              e.action === "signed up"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-indigo-500/10 text-indigo-400"
            )}>
              {e.action === "signed up" ? <UserPlus size={14} /> : <LogIn size={14} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("font-medium truncate", theme === "light" ? "text-slate-700" : "text-white")}>
                {e.name}
              </p>
              <p className={cn("text-xs", theme === "light" ? "text-slate-400" : "text-neutral-500")}>
                {e.action === "signed up" ? "Signed up" : "Logged in"}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-neutral-500 shrink-0">
              <Clock size={12} />
              {e.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
