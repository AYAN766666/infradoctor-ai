"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bot, MessageSquare, Eye, Activity, Users, ExternalLink } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://infradoctor-backend.vercel.app";

export default function MonitorPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [stats, setStats] = useState({ active_users: 0, today_chats: 0, today_visitors: 0 });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.push("/login"); return; }
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;

    const fetchStats = () => {
      fetch(`${API_BASE}/ai/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setStats(d))
        .catch(() => {});
    };

    fetchStats();
    const poll = setInterval(fetchStats, 5000);

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = (API_BASE || "").replace(/^https?:\/\//, "") || "localhost:8000";
    const ws = new WebSocket(`${protocol}://${host}?token=${token}`);

    ws.onopen = () => { setConnected(true); };
    ws.onclose = () => { setConnected(false); };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "agent_count") {
          setStats((prev) => ({ ...prev, active_users: msg.count }));
        }
        if (msg.type === "agent_stats" && msg.data) {
          setStats(msg.data);
        }
      } catch {}
    };

    return () => {
      clearInterval(poll);
      ws.close();
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Activity size={20} className="text-indigo-500" />
          <span className="font-bold text-lg tracking-tight">
            InfraDoctor<span className="text-indigo-500">AI</span>
          </span>
          <span className="text-xs text-neutral-600 ml-2">Live Monitor</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
          <span className="text-xs text-neutral-500">{connected ? "Live" : "Disconnected"}</span>
          <a
            href="/dashboard"
            className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
          >
            <ExternalLink size={12} /> Dashboard
          </a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-8 text-center">
            <Bot size={32} className="mx-auto mb-4 text-emerald-400" />
            <div className="text-7xl font-black text-emerald-400 mb-2">
              {stats.active_users}
              {stats.active_users > 0 && (
                <span className="inline-block w-4 h-4 ml-3 rounded-full bg-emerald-400 animate-pulse align-middle" />
              )}
            </div>
            <div className="text-emerald-400/60 text-sm font-medium uppercase tracking-widest">
              Active Now
            </div>
            <div className="text-emerald-400/30 text-xs mt-2">
              {stats.active_users === 0
                ? "No one is chatting"
                : `${stats.active_users} ${stats.active_users === 1 ? "person" : "people"} talking to AI`}
            </div>
          </div>

          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-3xl p-8 text-center">
            <MessageSquare size={32} className="mx-auto mb-4 text-indigo-400" />
            <div className="text-7xl font-black text-indigo-400 mb-2">{stats.today_chats}</div>
            <div className="text-indigo-400/60 text-sm font-medium uppercase tracking-widest">
              Today's Chats
            </div>
            <div className="text-indigo-400/30 text-xs mt-2">
              Total AI conversations today
            </div>
          </div>

          <div className="bg-violet-500/5 border border-violet-500/20 rounded-3xl p-8 text-center">
            <Eye size={32} className="mx-auto mb-4 text-violet-400" />
            <div className="text-7xl font-black text-violet-400 mb-2">{stats.today_visitors}</div>
            <div className="text-violet-400/60 text-sm font-medium uppercase tracking-widest">
              Today's Visitors
            </div>
            <div className="text-violet-400/30 text-xs mt-2">
              People who visited the site today
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-neutral-600 text-xs border-t border-white/5">
        Auto-updates every 5 seconds &bull; Real-time WebSocket when connected
      </footer>
    </div>
  );
}
