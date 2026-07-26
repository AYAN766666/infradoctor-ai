"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, LogIn, UserPlus, Clock, ArrowLeft, Activity } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://infradoctor-backend.vercel.app";

interface LoginEvent {
  name: string;
  action: string;
  time: string;
  date: string;
}

export default function ActivityPage() {
  const router = useRouter();
  const [data, setData] = useState<{ today_count: number; recent: LoginEvent[] } | null>(null);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
    fetch(`${API_BASE}/auth/activity`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  return (
    <div className={cn(
      "min-h-screen flex flex-col",
      theme === "light" ? "bg-gradient-to-br from-slate-50 to-blue-50/40 text-slate-800" : "bg-neutral-950 text-white"
    )}>
      <header className={cn(
        "flex items-center justify-between px-6 py-4 border-b",
        theme === "light" ? "border-slate-200 bg-white/70" : "border-white/5 bg-neutral-950/50"
      )}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className={cn("p-2 rounded-lg transition-colors", theme === "light" ? "hover:bg-slate-100 text-slate-600" : "hover:bg-white/5 text-neutral-400")}>
            <ArrowLeft size={20} />
          </Link>
          <Activity size={20} className="text-indigo-500" />
          <span className="font-bold text-lg tracking-tight">
            <span className={theme === "light" ? "text-slate-800" : "text-white"}>InfraDoctor</span><span className="text-indigo-500">AI</span>
          </span>
          <span className="text-xs text-neutral-500 ml-1">/ Activity</span>
        </div>
        <div className="flex items-center gap-2">
          <Users size={16} className="text-indigo-400" />
          <span className="text-2xl font-black text-indigo-400">{data?.today_count ?? "—"}</span>
          <span className="text-xs text-neutral-500">today</span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-6">
        <h1 className="text-xl font-bold mb-6">Login Activity</h1>
        {!data ? (
          <div className="text-center py-12 text-neutral-500 text-sm">Loading...</div>
        ) : data.recent.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-sm">No activity yet. Login or signup to see records.</div>
        ) : (
          <div className="space-y-1">
            {data.recent.map((e, i) => (
              <div key={i} className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors",
                theme === "light" ? "hover:bg-slate-50" : "hover:bg-white/5"
              )}>
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center",
                  e.action === "signed up"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-indigo-500/10 text-indigo-400"
                )}>
                  {e.action === "signed up" ? <UserPlus size={16} /> : <LogIn size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("font-medium", theme === "light" ? "text-slate-700" : "text-white")}>{e.name}</p>
                  <p className="text-xs text-neutral-500">{e.action === "signed up" ? "Signed up" : "Logged in"}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-neutral-500 shrink-0">
                  <Clock size={12} />
                  {e.date} at {e.time}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
