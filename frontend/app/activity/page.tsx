"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Clock, ArrowLeft, Activity, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://infradoctor-backend.vercel.app";

interface LoginEvent {
  name: string;
  action: string;
  time: string;
  date: string;
}

function Avatar({ name }: { name: string }) {
  const colors = [
    "from-emerald-500 to-teal-600",
    "from-indigo-500 to-purple-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
    "from-cyan-500 to-blue-600",
    "from-violet-500 to-fuchsia-600",
    "from-lime-500 to-green-600",
  ];
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const gradient = colors[hash % colors.length];
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br shadow-lg", gradient)}>
      {initial}
    </div>
  );
}

function TimelineDot({ index, theme }: { index: number; theme: string }) {
  const colors = [
    "bg-emerald-500 shadow-emerald-500/30",
    "bg-indigo-500 shadow-indigo-500/30",
    "bg-rose-500 shadow-rose-500/30",
    "bg-amber-500 shadow-amber-500/30",
    "bg-cyan-500 shadow-cyan-500/30",
  ];
  return (
    <div className={cn(
      "w-3 h-3 rounded-full shadow-lg absolute -left-[25px] top-1/2 -translate-y-1/2 ring-4",
      colors[index % colors.length],
      theme === "light" ? "ring-slate-50" : "ring-neutral-950"
    )} />
  );
}

export default function ActivityPage() {
  const router = useRouter();
  const [data, setData] = useState<{ today_count: number; recent: LoginEvent[] } | null>(null);
  const [currentTheme, setCurrentTheme] = useState("dark");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    const saved = localStorage.getItem("theme") || "dark";
    setCurrentTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
    fetch(`${API_BASE}/auth/activity`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {});
    const poll = setInterval(() => {
      fetch(`${API_BASE}/auth/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.ok ? r.json() : null).then((d) => d && setData(d)).catch(() => {});
    }, 10000);
    return () => clearInterval(poll);
  }, []);

  return (
    <div className={cn(
      "min-h-screen flex flex-col relative overflow-hidden",
      currentTheme === "light"
        ? "bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 text-slate-800"
        : "bg-gradient-to-br from-neutral-950 via-indigo-950/20 to-neutral-950 text-white"
    )}>
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      <header className={cn(
        "relative z-10 flex items-center justify-between px-6 py-4 border-b backdrop-blur-xl",
        currentTheme === "light" ? "border-slate-200/60 bg-white/60" : "border-white/5 bg-neutral-950/30"
      )}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className={cn(
            "p-2 rounded-xl transition-all hover:scale-105 active:scale-95",
            currentTheme === "light" ? "hover:bg-slate-100 text-slate-600" : "hover:bg-white/5 text-neutral-400"
          )}>
            <ArrowLeft size={20} />
          </Link>
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight">
              <span>InfraDoctor</span><span className="text-indigo-500">AI</span>
            </span>
            <span className="text-xs text-neutral-500 ml-2 font-medium">/ Signups</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20">
            <Users size={14} className="text-indigo-400" />
            <span className="text-xl font-black text-indigo-400">{data?.today_count ?? "—"}</span>
            <span className="text-xs text-indigo-400/60 font-medium">today</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400/80 font-medium uppercase tracking-widest">Live</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-2xl w-full mx-auto p-6">
        <AnimatePresence mode="wait">
          {!data ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24">
              <div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="mt-4 text-sm text-neutral-500">Loading activity...</p>
            </motion.div>
          ) : data.recent.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-24">
              <div className={cn(
                "w-20 h-20 rounded-3xl flex items-center justify-center mb-6 border",
                currentTheme === "light" ? "bg-slate-100 border-slate-200" : "bg-white/5 border-white/5"
              )}>
                <UserPlus size={36} className="text-neutral-500" />
              </div>
              <h2 className="text-lg font-bold mb-2">No signups yet</h2>
              <p className="text-sm text-neutral-500 text-center max-w-xs">
                When someone signs up, they&apos;ll appear here with their name and time.
              </p>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  New Members
                </h1>
                <span className="text-xs text-neutral-500">
                  Total: {data.recent.length}
                </span>
              </div>
              <div className="relative ml-5">
                {/* Timeline line */}
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-px",
                  currentTheme === "light" ? "bg-slate-200" : "bg-white/5"
                )} />
                {data.recent.map((e, i) => (
                  <motion.div
                    key={`${e.name}-${e.time}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    className="relative pl-8 pb-4 last:pb-0"
                  >
                    <TimelineDot index={i} theme={currentTheme} />
                    <div className={cn(
                      "group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 border",
                      currentTheme === "light"
                        ? "bg-white/80 border-slate-200/60 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5"
                        : "bg-white/[0.03] border-white/[0.06] hover:border-indigo-500/20 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-indigo-500/5"
                    )}>
                      <Avatar name={e.name} />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-semibold text-sm tracking-tight",
                          currentTheme === "light" ? "text-slate-800" : "text-white"
                        )}>
                          {e.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Sparkles size={11} className="text-emerald-400" />
                          <span className="text-[11px] text-emerald-400/80 font-medium">Joined</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-500 shrink-0">
                        <Clock size={12} />
                        <span>{e.date}</span>
                        <span className="text-neutral-600">·</span>
                        <span>{e.time}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 text-center py-4 text-neutral-600 text-xs border-t border-white/5">
        Auto-updates every 10 seconds
      </footer>
    </div>
  );
}
