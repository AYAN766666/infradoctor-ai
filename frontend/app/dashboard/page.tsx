"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://infradoctor-backend.vercel.app";
import { motion, AnimatePresence } from "framer-motion";
import { useWebSocket } from "@/hooks/useWebSocket";
import { 
  Activity, 
  LayoutDashboard, 
  Settings, 
  Bell, 
  Search,
  Plus,
  ArrowUpRight,
  Server,
  Database,
  ShieldCheck,
  Loader2,
  X,
  AlertTriangle,
  MessageCircle,
  Star,
  Trash2,
  Bot,
  ExternalLink,
  CheckCircle2,
  Menu,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface Project {
  id: number;
  name: string;
  github_url: string;
  environment: string;
  status: string;
  last_seen?: string;
  scan?: {
    id: number;
    status: string;
    score: number;
    issues_found: number;
    total_files: number;
  };
}

interface Alert {
  id: number;
  project_id: number;
  title: string;
  severity: string;
  status: string;
}

// --- View Components ---

function OverviewView({ projects, alerts, setShowAddModal, deleteProject, metrics, theme, focusedProjectId, setFocus, viewProjectScan, triggerScan, deletingId, setDeletingId }: any) {
  const [scores, setScores] = useState<any[]>([]);
  const activeProject = Array.isArray(projects) ? projects.find((p: Project) => p.id === focusedProjectId) : undefined;
  const activeScan = activeProject?.scan;
  const allScans = Array.isArray(projects) ? projects.map((p: Project) => p.scan).filter(Boolean) : [];
  const projectId = focusedProjectId || (projects.length > 0 ? projects[0].id : null);
  useEffect(() => {
    if (!projectId) return;
    const token = localStorage.getItem("token");
    fetch(`${API_BASE}/projects/${projectId}/scores`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : null).then(d => d?.scores && setScores(d.scores)).catch(() => {});
  }, [projectId]);
  const totalFiles = allScans.reduce((sum: number, s: any) => sum + (s.total_files || 0), 0);
  const totalIssues = allScans.reduce((sum: number, s: any) => sum + (s.issues_found || 0), 0);
  const totalBytes = allScans.reduce((sum: number, s: any) => {
    const match = s.total_size_hr?.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/);
    if (!match) return sum;
    const val = parseFloat(match[1]);
    const units: any = { B: 1, KB: 1024, MB: 1024**2, GB: 1024**3, TB: 1024**4 };
    return sum + val * (units[match[2]] || 1);
  }, 0);
  const aggSize = totalBytes > 0 ? formatBytes(totalBytes) : (activeScan?.total_size_hr || "0 B");
  const avgScore = allScans.length > 0 ? Math.round(allScans.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / allScans.length) : null;
  const displayScore = activeScan ? `${activeScan.score}%` : (avgScore !== null ? `${avgScore}% (avg)` : "N/A");
  const displayTrend = activeScan ? (activeScan.score >= 80 ? "Secure" : "Review") : (avgScore !== null ? (avgScore >= 80 ? "Secure" : "Review") : "No Data");
  const displayColor = activeScan ? (activeScan.score >= 80 ? "green" : "red") : (avgScore !== null ? (avgScore >= 80 ? "green" : "red") : "red");
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className={cn("text-2xl font-bold tracking-tight", theme === "light" ? "text-slate-900" : "text-white")}>System Overview</h1>
            {activeProject && (
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/50 text-indigo-500 text-xs font-bold uppercase tracking-widest">
                📍 {activeProject.name}
              </span>
            )}
          </div>
          {activeProject && (
            <p className={cn("text-xs mt-1", theme === "light" ? "text-slate-600" : "text-neutral-400")}>Active: <span className="font-bold">{activeProject.name}</span> • Environment: <span className="font-semibold text-indigo-500">{activeProject.environment}</span></p>
          )}
          <p className={cn("text-sm mt-2", theme === "light" ? "text-slate-500" : "text-neutral-500")}>Real-time health status of your infrastructure clusters.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 text-white"
        >
          <Plus size={18} />
          Add Resource
        </button>
      </div>

    </>
  );
}


function SecurityView({ projects, focusedProjectId }: { projects: Project[]; focusedProjectId: number | null }) {
  const [scanData, setScanData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [prResult, setPrResult] = useState<any>(null);

  const projectId = focusedProjectId || (projects.length > 0 ? projects[0].id : null);

  const fetchScan = () => {
    if (!projectId) return;
    setLoading(true);
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_BASE}/projects/${projectId}/scan`, { headers })
      .then(res => res.ok ? res.json() : { scan: null })
      .then(data => setScanData(data.scan))
      .catch(() => setScanData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchScan();
  }, [projectId]);

  const triggerScan = async () => {
    if (!projectId) return;
    setScanning(true);
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      await fetch(`${API_BASE}/projects/${projectId}/scan`, { method: "POST", headers });
      fetchScan();
    } catch (err) {
      console.error("Scan failed", err);
    } finally {
      setScanning(false);
    }
  };

  if (!projectId) return (
    <div className="flex items-center justify-center p-12 bg-neutral-900/50 rounded-3xl border border-white/5">
      <p className="text-neutral-500 text-sm">No project selected. Focus a project from Overview first.</p>
    </div>
  );

  if (loading && !scanData) return (
    <div className="flex items-center justify-center p-12 bg-neutral-900/50 rounded-3xl border border-white/5">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  const files = scanData?.files || [];
  const filesWithIssues = files.filter((f: any) => f.issue_count > 0);
  const totalIssues = files.reduce((sum: number, f: any) => sum + f.issue_count, 0);
  const scanError = scanData?.status === "error" ? (scanData?.error || "Scan failed") : null;

  return (
    <div className="space-y-8">
      {scanError && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-start gap-3">
          <AlertTriangle size={18} className="text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-yellow-500">Scan Failed</p>
            <p className="text-xs text-neutral-400 mt-1">{scanError}. Add a GITHUB_TOKEN to your backend .env file to fix rate limiting.</p>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Security Center</h1>
          <p className="text-neutral-500 text-sm mt-1">Scanned files and security issues from your repository.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={triggerScan} disabled={scanning} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-500 transition-all disabled:opacity-50">
            {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck size={14} />}
            {scanning ? "Scanning..." : "Rescan"}
          </button>
        </div>
      </div>

      {prResult && (prResult.message || prResult.error) && (
        <div className={`p-4 rounded-2xl flex items-start gap-3 ${prResult.pr_url ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-yellow-500/10 border border-yellow-500/20"}`}>
          {prResult.pr_url ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="text-yellow-500 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-500">{prResult.message || "Fix PR info"}</p>
            {prResult.pr_url && <a href={prResult.pr_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1 mt-1">View PR <ExternalLink size={10} /></a>}
            {prResult.error && <p className="text-xs text-neutral-400 mt-1">{prResult.error}</p>}
          </div>
          <button onClick={() => setPrResult(null)} className="text-neutral-500 hover:text-white"><X size={16} /></button>
        </div>
      )}

      {/* Files with Issues */}
      <div className="bg-neutral-900/50 border border-white/5 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h2 className="font-bold flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            Files with Security Issues ({filesWithIssues.length})
          </h2>
        </div>
        <div className="divide-y divide-white/5">
          {filesWithIssues.length > 0 ? (
            filesWithIssues.map((file: any, i: number) => (
              <div key={i} className="p-6 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold">{file.path}</h4>
                    <p className="text-xs text-neutral-500">{file.size_hr} • {file.issue_count} issue(s)</p>
                  </div>
                </div>
                <div className="space-y-2 ml-13">
                  {file.issues.map((issue: any, j: number) => (
                    <div key={j} className={cn(
                      "p-3 rounded-2xl border",
                      issue.severity === "critical" ? "bg-red-500/5 border-red-500/20" :
                      issue.severity === "high" ? "bg-amber-500/5 border-amber-500/20" :
                      "bg-yellow-500/5 border-yellow-500/20"
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          "text-xs font-bold uppercase tracking-wider",
                          issue.severity === "critical" ? "text-red-500" :
                          issue.severity === "high" ? "text-amber-500" : "text-yellow-500"
                        )}>
                          {issue.type}
                        </span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                          issue.severity === "critical" ? "bg-red-500/20 text-red-500" :
                          issue.severity === "high" ? "bg-amber-500/20 text-amber-500" :
                          "bg-yellow-500/20 text-yellow-500"
                        )}>
                          {issue.severity}
                        </span>
                      </div>
                      {issue.match && (
                        <p className="text-xs text-neutral-400 font-mono truncate">
                          Found: <span className="text-neutral-300">{issue.match}</span>
                        </p>
                      )}
                      {issue.remediation && (
                        <details className="mt-2 group">
                          <summary className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 cursor-pointer hover:text-indigo-300 select-none">
                            How to Fix ▸
                          </summary>
                          <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{issue.remediation}</p>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-neutral-500 text-sm">
              No files with issues found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewsView({ theme, userEmail }: { theme: string; userEmail: string }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");

  const fetchReviews = async () => {
    try {
      const res = await fetch(`${API_BASE}/reviews/`);
      if (res.ok) setReviews(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/reviews/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, title, comment }),
      });
      if (res.ok) {
        toast.success("Review submitted!");
        setRating(5);
        setTitle("");
        setComment("");
        fetchReviews();
      } else {
        toast.error("Failed to submit review");
      }
    } catch {
      toast.error("Network error");
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Submit Review */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("border rounded-3xl p-8", theme === "light" ? "bg-white border-slate-200" : "bg-neutral-900/50 border-white/5")}
      >
        <h2 className={cn("text-xl font-bold mb-6 flex items-center gap-2", theme === "light" ? "text-slate-800" : "text-white")}>
          <Star size={20} className="text-yellow-500" />
          Share Your Feedback
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Star Rating */}
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-bold mr-2", theme === "light" ? "text-slate-700" : "text-neutral-400")}>Rating:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <motion.button
                key={star}
                type="button"
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setRating(star)}
              >
                <Star
                  size={24}
                  className={star <= rating ? "text-yellow-500 fill-yellow-500" : "text-neutral-600"}
                />
              </motion.button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={cn(
              "w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors",
              theme === "light"
                ? "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400"
                : "bg-white/5 border-white/10 text-white placeholder:text-neutral-600"
            )}
          />

          <textarea
            placeholder="Write your review..."
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
            className={cn(
              "w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors resize-none",
              theme === "light"
                ? "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400"
                : "bg-white/5 border-white/10 text-white placeholder:text-neutral-600"
            )}
          />

          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-50 text-sm"
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </motion.button>
        </form>
      </motion.div>

      {/* All Reviews */}
      <div className="space-y-4">
        <h3 className={cn("text-lg font-bold", theme === "light" ? "text-slate-800" : "text-white")}>
          User Reviews ({reviews.length})
        </h3>
        {reviews.length === 0 ? (
          <p className="text-neutral-500 text-sm">No reviews yet. Be the first!</p>
        ) : (
          reviews.map((review, idx) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={cn(
                "border rounded-2xl p-6 transition-colors",
                theme === "light" ? "bg-white border-slate-200" : "bg-neutral-900/50 border-white/5"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                    {review.user_name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <p className={cn("font-bold text-sm", theme === "light" ? "text-slate-800" : "text-white")}>{review.user_name}</p>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} size={12} className={i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-neutral-600"} />
                      ))}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-neutral-500">{review.created_at ? new Date(review.created_at).toLocaleDateString() : ""}</span>
              </div>
              {review.title && (
                <h4 className={cn("font-bold text-sm mb-1", theme === "light" ? "text-slate-700" : "text-neutral-200")}>{review.title}</h4>
              )}
              <p className="text-sm text-neutral-500">{review.comment}</p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

function ScoreTimelineChart({ scores }: { scores: any[] }) {
  if (!scores || scores.length === 0) return null;
  const data = scores.map((s: any) => ({
    date: s.date ? new Date(s.date).toLocaleDateString() : "",
    score: s.score,
  }));
  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#525252" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#525252" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#171717", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: "#a3a3a3" }}
        />
        <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} fill="url(#scoreGrad)" dot={{ r: 3, fill: "#6366f1" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MetricsChart({ data, colors }: { data: any[]; colors: any }) {
  if (!data || data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#525252" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: "#525252" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#171717", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: "#a3a3a3" }}
        />
        <Line type="monotone" dataKey="cpu" stroke={colors.cpu} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="ram" stroke={colors.ram} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="disk" stroke={colors.disk} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AIChatView({ projects, focusedProjectId }: { projects: Project[]; focusedProjectId: number | null }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const projectId = focusedProjectId || (projects.length > 0 ? projects[0].id : null);
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);
  const sendMessage = async () => {
    if (!input.trim() || !projectId) return;
    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_id: projectId, message: input }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || "Sorry, I couldn't process that." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Network error. Please try again." }]);
    }
    setLoading(false);
  };
  if (!projectId) return <div className="p-12 text-center text-neutral-500 text-sm">No project selected.</div>;
  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bot size={24} className="text-indigo-500" /> AI Assistant
        </h1>
        <p className="text-neutral-500 text-sm mt-1">Ask about your infrastructure security, get remediation advice, or analyze logs.</p>
      </div>
      <div ref={chatRef} className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-[300px] max-h-[400px] p-4 rounded-3xl bg-neutral-900/50 border border-white/5">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot size={40} className="mx-auto text-indigo-500/30 mb-3" />
            <p className="text-neutral-500 text-sm">Ask me anything about your infrastructure security!</p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {["What issues did you find?", "How do I fix the exposed API keys?", "What's my security score trend?", "Generate a compliance report"].map((q, i) => (
                <button key={i} onClick={() => { setInput(q); }} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-neutral-400 hover:text-white hover:border-indigo-500/50 transition-all">{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === "user" ? "bg-indigo-600 text-white" : "bg-white/5 border border-white/10 text-neutral-200"}`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder="Ask about your infrastructure..." className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/50" />
        <button onClick={sendMessage} disabled={loading || !input.trim()} className="px-6 py-3 bg-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all disabled:opacity-50">Send</button>
      </div>
    </div>
  );
}

function InfrastructureView({ projectId }: { projectId?: number }) {
  const [infrastructure, setInfrastructure] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_BASE}/infrastructure/${projectId}`, { headers })
      .then(res => res.ok ? res.json() : [])
      .then(data => setInfrastructure(data))
      .catch(err => {
        console.error("Failed to fetch infrastructure", err);
        setInfrastructure([]);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return (
    <div className="text-white p-8 bg-neutral-900/50 rounded-3xl border border-white/5">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="text-white p-8 bg-neutral-900/50 rounded-3xl border border-white/5 space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Server size={20} className="text-indigo-500" />
        Infrastructure Clusters
      </h2>
      {infrastructure.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {infrastructure.map((cluster: any) => (
            <div key={cluster.id} className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg">{cluster.name}</h3>
                <span className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase", 
                  cluster.status === "Healthy" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                )}>{cluster.status}</span>
              </div>
              <div className="space-y-2 text-sm text-neutral-400">
                <p>Region: <span className="text-white">{cluster.region}</span></p>
                <p>Nodes: <span className="text-white">{cluster.nodes}</span></p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center text-neutral-500">
          No infrastructure clusters found. Add one to get started.
        </div>
      )}
    </div>
  );
}

function DatabasesView({ projectId }: { projectId?: number }) {
  const [databases, setDatabases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_BASE}/databases/${projectId}`, { headers })
      .then(res => res.ok ? res.json() : [])
      .then(data => setDatabases(data))
      .catch(err => {
        console.error("Failed to fetch databases", err);
        setDatabases([]);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return (
    <div className="text-white p-8 bg-neutral-900/50 rounded-3xl border border-white/5">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="text-white p-8 bg-neutral-900/50 rounded-3xl border border-white/5 space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Database size={20} className="text-indigo-500" />
        Database Instances
      </h2>
      {databases.length > 0 ? (
        <div className="space-y-4">
          {databases.map((db: any) => (
            <div key={db.id} className="p-6 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                  <Database size={24} />
                </div>
                <div>
                  <h3 className="font-bold">{db.name}</h3>
                  <p className="text-xs text-neutral-500">{db.type} • {db.size}</p>
                </div>
              </div>
              <span className={cn("text-sm font-bold", db.status === "Online" ? "text-green-500" : "text-yellow-500")}>{db.status}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center text-neutral-500">
          No databases found. Add one to get started.
        </div>
      )}
    </div>
  );
}

function SettingsView({ theme, setTheme, focusedProjectId, setFocusedProjectId, setProjects, setAlerts, fetchData, projects, deletingId, setDeletingId }: { theme: string; setTheme: (t: string) => void; focusedProjectId: number | null; setFocusedProjectId: (id: any) => void; setProjects: (p: any) => void; setAlerts: (a: any) => void; fetchData: () => void; projects: Project[]; deletingId: number | null; setDeletingId: (id: number | null) => void }) {
  const [settings, setSettings] = useState({ notifications: true, theme: theme, language: "en", apiKey: "********-****-****-****-************" });
  const [resetLoading, setResetLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_BASE}/settings/`, { headers })
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch settings");
        return res.json();
      })
      .then(data => {
        if (data) {
          setSettings(prev => ({ ...prev, ...data, theme }));
        }
      })
      .catch(err => console.error("Error loading settings", err));
  }, [theme]);

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    if (key === "theme") {
      setTheme(value);
    }
  };

  const handleReset = async () => {
    setShowResetConfirm(true);
  };

  const confirmReset = async () => {
    setShowResetConfirm(false);
    setResetLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/settings/reset`, { method: "POST", headers });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Reset failed");
        return;
      }
      toast.success(data.message || "System reset successfully");
      setFocusedProjectId(null);
      setProjects([]);
      setAlerts([]);
      await fetchData();
    } catch (err) {
      console.error("Reset failed", err);
      toast.error("Network error during reset");
    } finally {
      setResetLoading(false);
    }
  };

  const handleSettingsDeleteProject = async (id: number) => {
    setDeletingId(id);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/projects/${id}`, { method: "DELETE", headers });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Delete failed");
        return;
      }
      toast.success("Project deleted");
      if (focusedProjectId === id) {
        setFocusedProjectId(null);
      }
      fetchData();
    } catch (err) {
      toast.error("Network error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* Manage Projects */}
      <div className={cn(
        "border rounded-3xl p-8 transition-colors duration-300",
        theme === "light" ? "bg-white border-slate-200 shadow-sm" : "bg-neutral-900/50 border-white/5"
      )}>
        <h2 className={cn("text-xl font-bold mb-6 flex items-center gap-2", theme === "light" ? "text-slate-800" : "text-white")}>
          <Server size={20} className="text-indigo-500" />
          Manage Projects
        </h2>
        <div className="space-y-3">
          {projects.length > 0 ? projects.map((p: Project) => (
            <div key={p.id} className={cn(
              "flex items-center justify-between p-4 rounded-2xl border",
              theme === "light" ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/5"
            )}>
              <div>
                <p className={cn("font-bold text-sm", theme === "light" ? "text-slate-800" : "text-white")}>{p.name}</p>
                <p className="text-xs text-neutral-500">{p.github_url}</p>
              </div>
              <motion.button
                onClick={() => handleSettingsDeleteProject(p.id)}
                disabled={deletingId === p.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5",
                  deletingId === p.id
                    ? "bg-red-600/50 text-red-300 cursor-not-allowed"
                    : "bg-red-600/20 text-red-500 hover:bg-red-600/30"
                )}
              >
                {deletingId === p.id ? (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 size={14} />
                  </motion.span>
                ) : (
                  <Trash2 size={14} />
                )}
                {deletingId === p.id ? "Deleting..." : "Delete"}
              </motion.button>
            </div>
          )) : (
            <p className="text-sm text-neutral-500 text-center py-4">No projects found.</p>
          )}
        </div>
      </div>

      <div className={cn(
        "border rounded-3xl p-8 transition-colors duration-300",
        theme === "light" ? "bg-white border-slate-200 shadow-sm" : "bg-neutral-900/50 border-white/5"
      )}>
        <h2 className={cn("text-xl font-bold mb-6", theme === "light" ? "text-slate-800" : "text-white")}>General Settings</h2>
        <div className="space-y-4">
          <div className={cn(
            "flex items-center justify-between p-4 rounded-2xl border transition-colors duration-300",
            theme === "light" ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/5"
          )}>
            <div>
              <p className={cn("font-bold text-sm", theme === "light" ? "text-slate-800" : "text-white")}>Email Notifications</p>
              <p className="text-xs text-neutral-500">Receive alerts via email when incidents occur.</p>
            </div>
            <input type="checkbox" checked={settings.notifications} onChange={(e) => updateSetting("notifications", e.target.checked)} className="accent-indigo-500 h-5 w-5" />
          </div>
          <div className={cn(
            "flex items-center justify-between p-4 rounded-2xl border transition-colors duration-300",
            theme === "light" ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/5"
          )}>
            <div>
              <p className={cn("font-bold text-sm", theme === "light" ? "text-slate-800" : "text-white")}>Theme Preference</p>
              <p className="text-xs text-neutral-500">Switch between dark and light interface.</p>
            </div>
            <select 
              value={settings.theme} 
              onChange={(e) => updateSetting("theme", e.target.value)} 
              className={cn(
                "border rounded-xl p-2 text-sm outline-none focus:border-indigo-500/50 transition-colors duration-300",
                theme === "light" ? "bg-white border-slate-200 text-slate-900" : "bg-neutral-950 border-white/10 text-white"
              )}
            >
              <option value="dark">System Dark</option>
              <option value="light">Onyx Light</option>
            </select>
          </div>
        </div>
      </div>



      <div className={cn(
        "border rounded-3xl p-8 transition-colors duration-300",
        theme === "light" ? "bg-white border-red-200 shadow-sm" : "bg-neutral-900/50 border-white/5 border-red-500/20"
      )}>
        <h2 className="text-xl font-bold mb-2 text-red-500">Danger Zone</h2>
        <p className="text-xs text-neutral-500 mb-6">Irreversible actions for system maintenance.</p>
        <div className={cn(
          "p-6 rounded-2xl border flex items-center justify-between transition-colors duration-300",
          theme === "light" ? "bg-red-50 border-red-100" : "bg-red-500/5 border-red-500/10"
        )}>
          <div>
            <p className={cn("font-bold text-sm", theme === "light" ? "text-slate-800" : "text-white")}>Reset System Database</p>
            <p className="text-xs text-neutral-500">Delete all projects, logs, and AI history to start fresh.</p>
          </div>
          {showResetConfirm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-neutral-800 p-6 rounded-3xl shadow-2xl max-w-sm w-full text-white border border-white/10">
                <h2 className="text-lg font-bold mb-3">Confirm Reset</h2>
                <p className="text-sm text-neutral-400 mb-6">Are you absolutely sure you want to delete all projects, logs, and alerts? This action cannot be undone.</p>
                <div className="flex justify-end gap-3">
                  <button
                    className="px-4 py-2 bg-neutral-700 rounded-xl text-sm font-bold hover:bg-neutral-600"
                    onClick={() => setShowResetConfirm(false)}
                    disabled={resetLoading}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-red-600 rounded-xl text-sm font-bold hover:bg-red-500"
                    onClick={confirmReset}
                    disabled={resetLoading}
                  >
                    {resetLoading ? "Resetting..." : "Yes, Reset All"}
                  </button>
                </div>
              </div>
            </div>
          )}
          <button 
            onClick={handleReset}
            disabled={resetLoading}
            className="px-6 py-3 bg-red-600 rounded-xl text-xs font-bold hover:bg-red-500 transition-colors disabled:opacity-50 text-white"
          >
            {resetLoading ? "Resetting..." : "Reset All Data"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [activeView, setActiveView] = useState("Overview");
  const [projects, setProjects] = useState<Project[]>([]);
  const [focusedProjectId, setFocusedProjectId] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanningProgress, setScanningProgress] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", github_url: "", environment: "production" });
  const [backendError, setBackendError] = useState<string | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [viewingScanProject, setViewingScanProject] = useState<number | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const name = localStorage.getItem("user_name");
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    if (name) setUserName(name);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_email");
    router.push("/login");
  };

  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme") || "dark";
      document.documentElement.setAttribute("data-theme", saved);
      return saved;
    }
    return "dark";
  });

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
    }
  };

  const [userId, setUserId] = useState<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem("user_id");
    if (stored) setUserId(Number(stored));
  }, []);

  // Use a ref to always have access to the latest projects in intervals
  const projectsRef = useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const onWsMetrics = useCallback((data: any) => {
    setMetrics(data);
  }, []);

  const onWsAlerts = useCallback(({ project_id, data }: any) => {
    setAlerts(data);
  }, []);

  const onWsProjects = useCallback((data: any) => {
    setProjects(data);
  }, []);

  const wsEnabled = typeof window !== "undefined" && !!localStorage.getItem("token");
  const { connected: wsConnected } = useWebSocket({
    onMetrics: onWsMetrics,
    onAlerts: onWsAlerts,
    onProjects: onWsProjects,
    enabled: wsEnabled,
  });

  useEffect(() => {
    fetchData();

    const alertInterval = setInterval(() => {
      if (projectsRef.current.length > 0 && !wsConnected) {
        fetchAlerts(projectsRef.current[0].id);
      }
    }, 10000);

    const metricsInterval = setInterval(() => {
      if (!wsConnected) fetchMetrics();
    }, 5000);

    return () => {
      clearInterval(alertInterval);
      clearInterval(metricsInterval);
    };
  }, [wsConnected]);

  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = async () => {
    setLoading(true);
    setBackendError(null);
    try {
      const pRes = await fetch(`${API_BASE}/projects/`, { headers: authHeaders() });
      if (!pRes.ok) throw new Error(`Backend error: ${pRes.statusText}`);
      const pData = await pRes.json();
      const pList = pData.projects || pData;
      setProjects(pList);
      try {
        const focusRes = await fetch(`${API_BASE}/settings/focus`, { headers: authHeaders() });
        if (focusRes.ok) {
          const f = await focusRes.json();
          if (f.project_id) setFocusedProjectId(f.project_id);
        }
      } catch (e) {}
      if (pList.length > 0) {
        const pid = focusedProjectId || pList[0].id;
        fetchAlerts(pid);
        fetchMetrics();
      }
    } catch (err: any) {
      console.error("Failed to fetch projects", err);
      setBackendError("Cannot connect to backend server. Make sure it is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE}/metrics/`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Failed to fetch metrics", err);
    }
  };

  const fetchAlerts = async (projectId: number) => {
    try {
      const res = await fetch(`${API_BASE}/alerts/${projectId}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.reverse().slice(0, 10));
      }
    } catch (err) {
      console.error("Failed to fetch alerts", err);
    }
  };

  const setFocus = async (projectId: number) => {
    try {
      const res = await fetch(`${API_BASE}/settings/focus`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      });
      if (res.ok) {
        setFocusedProjectId(projectId);
        fetchAlerts(projectId);
        fetchMetrics();
      }
    } catch (e) { console.error('Failed to set focus', e); }
  };

  const deleteProject = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${id}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Delete failed");
        return;
      }
      toast.success("Project deleted successfully");
      // If deleted project was active, clear focus
      if (focusedProjectId === id) {
        setFocusedProjectId(null);
      }
      fetchData();
    } catch (err) {
      console.error("Failed to delete project", err);
      toast.error("Network error while deleting project");
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newProject.name.trim()) {
      toast.error("Project name is required!");
      return;
    }
    if (!newProject.github_url.trim()) {
      toast.error("GitHub URL is required!");
      return;
    }
    
    setScanning(true);
    setScanningProgress("Creating project...");
    
    try {
      const payload = {
        name: newProject.name.trim(),
        github_url: newProject.github_url.trim(),
        environment: newProject.environment || "production"
      };
      
      setScanningProgress("Fetching repository data...");
      const res = await fetch(`${API_BASE}/projects/`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setScanningProgress("Scanning for security issues...");
        await new Promise(r => setTimeout(r, 800));
        setScanningProgress("Analyzing results...");
        await new Promise(r => setTimeout(r, 600));
        
        setScanning(false);
        setScanningProgress("");
        setShowAddModal(false);
        setNewProject({ name: "", github_url: "", environment: "production" });
        await fetchData();
        if (data.scan) {
          setScanResult(data.scan);
          setViewingScanProject(data.project.id);
          setShowScanModal(true);
        }
      } else {
        setScanning(false);
        setScanningProgress("");
        toast.error("Failed to add project: " + (data.detail ? JSON.stringify(data.detail) : "Unknown error"));
      }
    } catch (err) {
      setScanning(false);
      setScanningProgress("");
      toast.error("Network error while adding project");
    }
  };

  const viewProjectScan = async (projectId: number) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/scan`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok && data.scan) {
        setScanResult(data.scan);
        setViewingScanProject(projectId);
        setShowScanModal(true);
      } else {
        toast.error("No scan data available");
      }
    } catch (err) {
      toast.error("Failed to fetch scan results");
    }
  };

  const triggerScan = async (projectId: number) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/scan`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        toast.success("Scan completed!");
        setScanResult(data);
        setViewingScanProject(projectId);
        setShowScanModal(true);
        await fetchData();
      } else {
        toast.error(data.detail || "Scan failed");
      }
    } catch (err) {
      toast.error("Network error during scan");
    }
  };

  return (
    <div className={cn(
      "flex h-screen overflow-hidden transition-colors duration-300",
      theme === "light" ? "bg-slate-50 text-slate-900" : "bg-neutral-950 text-white"
    )}>
      {/* Mobile menu button */}
      <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} className="fixed top-4 left-4 z-50 lg:hidden p-2 bg-neutral-900 border border-white/10 rounded-xl text-white">
        <Menu size={20} />
      </button>

      <aside className={cn(
        "w-64 border-r flex flex-col backdrop-blur-xl transition-all duration-300",
        theme === "light" ? "bg-white/70 border-slate-200" : "bg-neutral-900/50 border-white/5",
        "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:shadow-2xl",
        mobileSidebarOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className={cn("text-lg font-bold tracking-tight", theme === "light" ? "text-slate-800" : "text-white")}>
            InfraDoctor<span className="text-indigo-500">AI</span>
          </span>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Overview" active={activeView === "Overview"} onClick={() => { setActiveView("Overview"); setMobileSidebarOpen(false); }} theme={theme} />
          <SidebarItem icon={<Server size={20} />} label="Infrastructure" active={activeView === "Infrastructure"} onClick={() => { setActiveView("Infrastructure"); setMobileSidebarOpen(false); }} theme={theme} />
          <SidebarItem icon={<Database size={20} />} label="Databases" active={activeView === "Databases"} onClick={() => { setActiveView("Databases"); setMobileSidebarOpen(false); }} theme={theme} />
          <SidebarItem icon={<ShieldCheck size={20} />} label="Security" active={activeView === "Security"} onClick={() => { setActiveView("Security"); setMobileSidebarOpen(false); }} theme={theme} />
          <SidebarItem icon={<Bot size={20} />} label="AI Chat" active={activeView === "AIChat"} onClick={() => { setActiveView("AIChat"); setMobileSidebarOpen(false); }} theme={theme} />
          <SidebarItem icon={<MessageCircle size={20} />} label="Reviews" active={activeView === "Reviews"} onClick={() => { setActiveView("Reviews"); setMobileSidebarOpen(false); }} theme={theme} />
          <SidebarItem icon={<Settings size={20} />} label="Settings" active={activeView === "Settings"} onClick={() => { setActiveView("Settings"); setMobileSidebarOpen(false); }} theme={theme} />
        </nav>
        {/* Close button on mobile */}
        <button onClick={() => setMobileSidebarOpen(false)} className="lg:hidden p-4 text-neutral-500 hover:text-white border-t border-white/5 flex items-center gap-2 text-sm">
          <ChevronDown size={16} className="rotate-90" /> Close
        </button>
      </aside>
      {mobileSidebarOpen && <div onClick={() => setMobileSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-30 lg:hidden" />}

        <main className="flex-1 flex flex-col overflow-hidden">
        <header className={cn(
          "h-16 border-b flex items-center justify-between px-4 sm:px-8 backdrop-blur-md sticky top-0 z-10 transition-colors duration-300",
          theme === "light" ? "bg-white/50 border-slate-200" : "bg-neutral-950/50 border-white/5"
        )}>
          <div className={cn(
            "hidden sm:flex items-center gap-4 px-4 py-2 rounded-xl border w-48 lg:w-96 transition-colors duration-300",
            theme === "light" ? "bg-slate-100 border-slate-200 text-slate-800" : "bg-white/5 border-white/5 text-white"
          )}>
            <Search size={18} className="text-neutral-500 shrink-0" />
            <input 
              type="text" 
              placeholder="Search..." 
              className={cn(
                "bg-transparent border-none outline-none text-sm w-full transition-colors duration-300",
                theme === "light" ? "text-slate-800 placeholder:text-slate-400" : "text-neutral-300 placeholder:text-neutral-600"
              )}
            />
          </div>
          <button className="sm:hidden p-2 rounded-xl border border-white/10 text-neutral-500 hover:text-white transition-colors" title="Search">
            <Search size={18} />
          </button>
          <div className="flex items-center gap-3">
            {backendError && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-500 font-bold uppercase tracking-wider">
                Backend Offline
              </div>
            )}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              whileHover={{ scale: 1.02 }}
              className={cn(
                "flex items-center gap-3 px-4 py-2 rounded-xl border transition-colors relative overflow-hidden group",
                theme === "light" ? "bg-gradient-to-r from-slate-100 to-slate-50 border-slate-200" : "bg-gradient-to-r from-white/5 to-white/[0.02] border-white/5"
              )}
            >
              {/* Animated glow */}
              <motion.div
                className="absolute inset-0 bg-indigo-600/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                animate={{ opacity: [0, 0.3, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-indigo-500/25 relative z-10"
              >
                {(userName || "U")[0].toUpperCase()}
              </motion.div>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className={cn("text-sm font-bold relative z-10", theme === "light" ? "text-slate-800" : "text-white")}
              >
                {userName || "User"}
              </motion.span>
              <motion.button
                onClick={handleLogout}
                whileHover={{ scale: 1.05, backgroundColor: "rgba(239, 68, 68, 0.3)" }}
                whileTap={{ scale: 0.95 }}
                className="px-3 py-1 bg-red-600/20 text-red-500 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-red-600/30 transition-colors relative z-10"
              >
                Logout
              </motion.button>
            </motion.div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          {backendError && activeView === "Overview" && (
            <div className="mb-8 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl">
              <h3 className="text-red-500 font-bold mb-1">Connection Error</h3>
              <p className="text-sm text-neutral-400">{backendError}</p>
            </div>
          )}
          {activeView === "Overview" && <OverviewView projects={projects} alerts={alerts} setShowAddModal={setShowAddModal} deleteProject={deleteProject} metrics={metrics} theme={theme} focusedProjectId={focusedProjectId} setFocus={setFocus} viewProjectScan={viewProjectScan} triggerScan={triggerScan} deletingId={deletingId} setDeletingId={setDeletingId} />}
          {activeView === "Infrastructure" && <InfrastructureView projectId={focusedProjectId || (projects.length > 0 ? projects[0].id : undefined)} />}
          {activeView === "Databases" && <DatabasesView projectId={focusedProjectId || (projects.length > 0 ? projects[0].id : undefined)} />}
          {activeView === "Security" && <SecurityView projects={projects} focusedProjectId={focusedProjectId} />}
          {activeView === "AIChat" && <AIChatView projects={projects} focusedProjectId={focusedProjectId} />}
          {activeView === "Reviews" && <ReviewsView theme={theme} userEmail={userName} />}
          {activeView === "Settings" && <SettingsView theme={theme} setTheme={handleThemeChange} focusedProjectId={focusedProjectId} setFocusedProjectId={setFocusedProjectId} setProjects={setProjects} setAlerts={setAlerts} fetchData={fetchData} projects={projects} deletingId={deletingId} setDeletingId={setDeletingId} />}
        </div>
      </main>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { if (!scanning) setShowAddModal(false); }} className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className={cn(
              "relative w-full max-w-lg border rounded-3xl p-8 shadow-2xl transition-colors duration-300 overflow-hidden",
              theme === "light" ? "bg-white border-slate-200" : "bg-neutral-900 border-white/10"
            )}>
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="relative w-20 h-20 mb-6">
                    <motion.div
                      className="absolute inset-0 rounded-full border-4 border-indigo-500/30"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div
                      className="absolute inset-2 rounded-full bg-indigo-600/20 flex items-center justify-center"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Activity size={24} className="text-indigo-500" />
                    </motion.div>
                  </div>
                  <motion.p
                    className="text-sm font-bold text-indigo-400"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {scanningProgress}
                  </motion.p>
                  <div className="flex gap-1.5 mt-4">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-indigo-500"
                        animate={{ y: [0, -8, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className={cn("text-2xl font-bold tracking-tight", theme === "light" ? "text-slate-800" : "text-white")}>Add New Resource</h2>
                    <button onClick={() => setShowAddModal(false)} className={cn("p-2 transition-colors", theme === "light" ? "text-slate-400 hover:text-slate-800" : "text-neutral-500 hover:text-white")}><X size={20} /></button>
                  </div>
                  <form onSubmit={handleAddProject} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 ml-1">Project Name</label>
                      <input 
                        required 
                        type="text" 
                        className={cn(
                          "w-full border rounded-2xl py-4 px-5 outline-none focus:border-indigo-500/50 transition-all text-sm",
                          theme === "light" ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-neutral-950 border-white/5 text-white"
                        )}
                        value={newProject.name} 
                        onChange={(e) => setNewProject({...newProject, name: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 ml-1">GitHub Repository URL</label>
                      <input 
                        required 
                        type="url" 
                        className={cn(
                          "w-full border rounded-2xl py-4 px-5 outline-none focus:border-indigo-500/50 transition-all text-sm",
                          theme === "light" ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-neutral-950 border-white/5 text-white"
                        )}
                        value={newProject.github_url} 
                        onChange={(e) => setNewProject({...newProject, github_url: e.target.value})} 
                        placeholder="https://github.com/user/repo" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 ml-1">Environment</label>
                      <select 
                        className={cn(
                          "w-full border rounded-2xl py-4 px-5 outline-none focus:border-indigo-500/50 transition-all text-sm",
                          theme === "light" ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-neutral-950 border-white/5 text-white"
                        )}
                        value={newProject.environment}
                        onChange={(e) => setNewProject({...newProject, environment: e.target.value})}
                      >
                        <option value="production">Production</option>
                        <option value="staging">Staging</option>
                        <option value="development">Development</option>
                      </select>
                    </div>
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-4 bg-indigo-600 rounded-2xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 text-white"
                    >
                      Confirm & Scan
                    </motion.button>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scan Results Modal */}
      <AnimatePresence>
        {showScanModal && scanResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowScanModal(false)} className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className={cn(
              "relative w-full max-w-3xl max-h-[85vh] overflow-y-auto border rounded-3xl p-8 shadow-2xl",
              theme === "light" ? "bg-white border-slate-200" : "bg-neutral-900 border-white/10"
            )}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={cn("text-2xl font-bold tracking-tight flex items-center gap-3", theme === "light" ? "text-slate-800" : "text-white")}>
                  <ShieldCheck size={24} className={scanResult.secure ? "text-green-500" : "text-red-500"} />
                  Security Scan Results
                </h2>
                <button onClick={() => setShowScanModal(false)} className={cn("p-2 transition-colors", theme === "light" ? "text-slate-400 hover:text-slate-800" : "text-neutral-500 hover:text-white")}><X size={20} /></button>
              </div>

              {scanResult.error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                  <p className="text-red-500 text-sm font-bold">Scan Error: {scanResult.error}</p>
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className={cn("p-4 rounded-2xl border", theme === "light" ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/5")}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Security Score</p>
                  <p className={cn("text-2xl font-bold", scanResult.secure ? "text-green-500" : "text-red-500")}>{scanResult.score}%</p>
                  <p className={cn("text-xs mt-1", scanResult.secure ? "text-green-500" : "text-red-500")}>{scanResult.secure ? "Secure" : "Issues Found"}</p>
                </div>
                <div className={cn("p-4 rounded-2xl border", theme === "light" ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/5")}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Files</p>
                  <p className={cn("text-2xl font-bold", theme === "light" ? "text-slate-800" : "text-white")}>{scanResult.total_files}</p>
                  <p className="text-xs text-neutral-500 mt-1">Total files scanned</p>
                </div>
                <div className={cn("p-4 rounded-2xl border", theme === "light" ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/5")}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Issues</p>
                  <p className={cn("text-2xl font-bold", scanResult.issues_found > 0 ? "text-red-500" : "text-green-500")}>{scanResult.issues_found}</p>
                  <p className="text-xs text-neutral-500 mt-1">{scanResult.sensitive_files_count || 0} sensitive files</p>
                </div>
                <div className={cn("p-4 rounded-2xl border", theme === "light" ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/5")}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Storage</p>
                  <p className={cn("text-2xl font-bold", theme === "light" ? "text-slate-800" : "text-white")}>{scanResult.total_size_hr || "0 B"}</p>
                  <p className="text-xs text-neutral-500 mt-1">{scanResult.large_files_count || 0} large files</p>
                </div>
              </div>

              {/* Files with Issues */}
              {(scanResult.files || []).filter((f: any) => f.issue_count > 0).length > 0 && (
                <div className="mb-6">
                  <h3 className={cn("font-bold mb-4 flex items-center gap-2", theme === "light" ? "text-slate-800" : "text-white")}>
                    <AlertTriangle size={16} className="text-amber-500" />
                    Files with Issues ({scanResult.files.filter((f: any) => f.issue_count > 0).length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {scanResult.files.filter((f: any) => f.issue_count > 0).map((file: any, idx: number) => (
                      <div key={idx} className={cn(
                        "p-4 rounded-2xl border flex items-start justify-between",
                        theme === "light" ? "bg-red-50 border-red-100" : "bg-red-500/5 border-red-500/10"
                      )}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{file.path}</p>
                          <p className="text-[10px] text-neutral-500 mt-1">{file.size_hr} • {file.issue_count} issue(s)</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {file.issues.map((issue: any, i: number) => (
                              <span key={i} className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                                issue.severity === "critical"
                                  ? "bg-red-500/20 text-red-500"
                                  : issue.severity === "high"
                                  ? "bg-amber-500/20 text-amber-500"
                                  : "bg-yellow-500/20 text-yellow-500"
                              )}>
                                {issue.type}
                              </span>
                            ))}
                          </div>
                          {file.issues.filter((i: any) => i.remediation).length > 0 && (
                            <details className="mt-3 group">
                              <summary className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 cursor-pointer hover:text-indigo-300 select-none">
                                How to Fix ▸
                              </summary>
                              <div className="mt-2 space-y-2">
                                {file.issues.filter((i: any) => i.remediation).map((issue: any, i: number) => (
                                  <div key={i} className="text-xs text-neutral-400 leading-relaxed">
                                    <span className="font-bold text-neutral-300">{issue.type}:</span> {issue.remediation}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Large Files */}
              {(scanResult.large_files || []).length > 0 && (
                <div className="mb-6">
                  <h3 className={cn("font-bold mb-4 flex items-center gap-2", theme === "light" ? "text-slate-800" : "text-white")}>
                    <Server size={16} className="text-yellow-500" />
                    Large Files ({scanResult.large_files.length})
                  </h3>
                  <div className="space-y-2">
                    {scanResult.large_files.map((lf: any, idx: number) => (
                      <div key={idx} className={cn(
                        "p-3 rounded-2xl border flex items-center justify-between",
                        theme === "light" ? "bg-yellow-50 border-yellow-100" : "bg-yellow-500/5 border-yellow-500/10"
                      )}>
                        <p className="text-sm font-medium truncate">{lf.path}</p>
                        <span className="text-xs font-bold text-neutral-500 ml-2 shrink-0">{lf.size_hr || "500+ KB"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sensitive Files List */}
              {(scanResult.sensitive_files || []).length > 0 && (
                <div>
                  <h3 className={cn("font-bold mb-4 flex items-center gap-2", theme === "light" ? "text-slate-800" : "text-white")}>
                    <ShieldCheck size={16} className="text-red-500" />
                    Sensitive Files Found ({scanResult.sensitive_files.length})
                  </h3>
                  <div className="space-y-2">
                    {scanResult.sensitive_files.map((sf: string, idx: number) => (
                      <div key={idx} className={cn(
                        "p-3 rounded-2xl border flex items-center justify-between",
                        theme === "light" ? "bg-red-50 border-red-100" : "bg-red-500/5 border-red-500/10"
                      )}>
                        <p className="text-sm font-mono truncate">{sf}</p>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/20 text-red-500 ml-2 shrink-0">Sensitive</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Issues */}
              {(scanResult.files || []).filter((f: any) => f.issue_count > 0).length === 0 && !scanResult.error && (
                <div className="p-12 text-center">
                  <ShieldCheck size={48} className="mx-auto text-green-500 mb-4" />
                  <p className={cn("text-lg font-bold", theme === "light" ? "text-slate-800" : "text-white")}>No Security Issues Found</p>
                  <p className="text-sm text-neutral-500 mt-2">Your project looks clean. {scanResult.total_files || 0} files scanned.</p>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowScanModal(false)}
                  className="px-6 py-3 bg-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all text-white"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({ icon, label, active = false, onClick, theme }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, theme?: string }) {
  return (
    <button onClick={onClick} className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
      active 
        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
        : theme === "light"
          ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          : "text-neutral-400 hover:text-white hover:bg-white/5"
    )}>
      {icon}
      {label}
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

function StatCard({ label, value, trend, color = "indigo", theme }: { label: string, value: string, trend: string, color?: string, theme?: string }) {
  const trendColors: any = { green: "text-green-500", red: "text-red-500", yellow: "text-yellow-500", indigo: "text-indigo-500" };
  return (
    <div className={cn(
      "border p-6 rounded-3xl transition-all duration-300",
      theme === "light" 
        ? "bg-white border-slate-200 shadow-sm hover:border-indigo-200" 
        : "bg-neutral-900/50 border-white/5 hover:border-white/10"
    )}>
      <p className={cn("text-xs font-medium uppercase tracking-wider mb-2", theme === "light" ? "text-slate-400" : "text-neutral-500")}>{label}</p>
      <div className="flex items-end justify-between">
        <h3 className={cn("text-2xl font-bold tracking-tight", theme === "light" ? "text-slate-800" : "text-white")}>{value}</h3>
        <span className={cn("text-xs font-bold", trendColors[color])}>{trend}</span>
      </div>
    </div>
  );
}

function IncidentRow({ title, time, status, owner, theme }: { title: string, time: string, status: string, owner: string, theme?: string }) {
  const statusConfig: any = {
    Critical: "bg-red-500/10 text-red-500 border-red-500/20",
    Warning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    Resolved: "bg-green-500/10 text-green-500 border-green-500/20",
  };
  return (
    <div className={cn(
      "p-6 flex items-center justify-between transition-colors group",
      theme === "light" ? "hover:bg-slate-50 border-slate-100" : "hover:bg-white/5 border-white/5"
    )}>
      <div className="flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", statusConfig[status])}>
          <ArrowUpRight size={20} />
        </div>
        <div>
          <h4 className={cn(
            "text-sm font-bold tracking-tight transition-colors",
            theme === "light" 
              ? "text-slate-800 group-hover:text-indigo-600" 
              : "text-white group-hover:text-indigo-400"
          )}>{title}</h4>
          <p className={cn("text-xs mt-1", theme === "light" ? "text-slate-400" : "text-neutral-500")}>
            {time} • Managed by <span className={theme === "light" ? "text-slate-600" : "text-neutral-300"}>{owner}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border", statusConfig[status])}>{status}</span>
      </div>
    </div>
  );
}
