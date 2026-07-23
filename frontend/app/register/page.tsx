"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, Mail, Lock, User, ArrowRight, Loader2, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved ? saved === "dark" : true;
    setDarkMode(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });

      if (res.ok) {
        router.push("/login");
      } else {
        const data = await res.json();
        setError(data.detail || "Registration failed. Please try again.");
      }
    } catch (err) {
      setError("Network error. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-300 ${darkMode ? "bg-neutral-950 text-white" : "bg-slate-50 text-slate-900"}`}>
      {/* Background Glow */}
      {darkMode && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full -z-10" />}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold tracking-tight">InfraDoctor<span className="text-indigo-500">AI</span></span>
            </Link>
            <button onClick={toggleTheme} className={`p-2 rounded-xl transition-colors duration-300 ${darkMode ? "bg-white/5 hover:bg-white/10 text-white" : "bg-slate-200 hover:bg-slate-300 text-slate-700"}`}>
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
          <h1 className={`text-3xl font-bold tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}>Create an account</h1>
          <p className={`${darkMode ? "text-neutral-500" : "text-slate-600"} mt-2`}>Start monitoring your infrastructure for free.</p>
        </div>

        <div className={`p-4 sm:p-8 rounded-3xl backdrop-blur-xl shadow-2xl transition-colors duration-300 ${darkMode ? "bg-neutral-900/50 border border-white/5" : "bg-white border border-slate-200"}`}>
          <form onSubmit={handleRegister} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className={`text-xs font-bold uppercase tracking-widest ml-1 ${darkMode ? "text-neutral-500" : "text-slate-600"}`}>Full Name</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-indigo-500 transition-colors" />
                <motion.input 
                  whileFocus={{ scale: 1.02 }}
                  type="text" 
                  required
                  placeholder="John Doe" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500/50 transition-all text-sm transition-colors duration-300 ${darkMode ? "bg-neutral-950 border border-white/5 placeholder:text-neutral-700" : "bg-slate-100 border border-slate-300 placeholder:text-slate-400 text-slate-900"}`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-bold uppercase tracking-widest ml-1 ${darkMode ? "text-neutral-500" : "text-slate-600"}`}>Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-indigo-500 transition-colors" />
                <motion.input 
                  whileFocus={{ scale: 1.02 }}
                  type="email" 
                  required
                  placeholder="name@company.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500/50 transition-all text-sm transition-colors duration-300 ${darkMode ? "bg-neutral-950 border border-white/5 placeholder:text-neutral-700" : "bg-slate-100 border border-slate-300 placeholder:text-slate-400 text-slate-900"}`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className={`text-xs font-bold uppercase tracking-widest ml-1 ${darkMode ? "text-neutral-500" : "text-slate-600"}`}>Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-indigo-500 transition-colors" />
                <motion.input 
                  whileFocus={{ scale: 1.02 }}
                  type="password" 
                  required
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500/50 transition-all text-sm transition-colors duration-300 ${darkMode ? "bg-neutral-950 border border-white/5 placeholder:text-neutral-700" : "bg-slate-100 border border-slate-300 placeholder:text-slate-400 text-slate-900"}`}
                />
              </div>
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-indigo-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20 mt-4"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </motion.button>
          </form>

          <p className={`text-center text-sm mt-8 ${darkMode ? "text-neutral-500" : "text-slate-600"}`}>
            Already have an account?{" "}
            <Link href="/login" className="text-indigo-500 font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
