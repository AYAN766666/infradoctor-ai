"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user_name", data.name);
        localStorage.setItem("user_email", data.email);
        localStorage.setItem("user_id", String(data.user_id));
        router.push("/dashboard");
      } else {
        const data = await res.json();
        setError(data.detail || "Invalid email or password.");
      }
    } catch (err) {
      setError("Network error. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full -z-10" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">InfraDoctor<span className="text-indigo-500">AI</span></span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-neutral-500 mt-2">Enter your credentials to access your dashboard.</p>
        </div>

        <div className="bg-neutral-900/50 border border-white/5 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="email" 
                  required
                  placeholder="name@company.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-950 border border-white/5 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500/50 transition-all text-sm placeholder:text-neutral-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500">Password</label>
                <a href="#" className="text-xs text-indigo-500 hover:underline">Forgot?</a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="password" 
                  required
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-950 border border-white/5 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500/50 transition-all text-sm placeholder:text-neutral-700"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-indigo-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20 mt-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-center text-neutral-500 text-sm mt-8">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-indigo-500 font-bold hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
