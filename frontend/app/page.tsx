"use client";

import { motion, useInView } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://infradoctor-backend.vercel.app";
import { 
  Activity, Shield, Zap, BarChart3, ChevronRight, Terminal,
  Globe, CheckCircle2, Star, MessageCircle, Menu, X, Sun, Moon,
  GitBranch, Lock, Webhook, FileWarning, Scan,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";

function FadeInView({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <div ref={ref} className={className}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6, delay, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

function FeatureCard({ icon, title, description, darkMode, index }: { icon: React.ReactNode; title: string; description: string; darkMode: boolean; index: number }) {
  return (
    <FadeInView delay={index * 0.1}>
      <div className={`group p-4 sm:p-8 rounded-3xl transition-all hover:-translate-y-1 ${darkMode ? "border border-white/5 bg-neutral-900/50 hover:bg-neutral-900" : "border border-slate-200 bg-white hover:bg-slate-50 shadow-sm"}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${darkMode ? "bg-white/5" : "bg-slate-100"}`}>
          {icon}
        </div>
        <h3 className={`text-xl font-bold mb-3 tracking-tight ${darkMode ? "" : "text-slate-900"}`}>{title}</h3>
        <p className={`leading-relaxed text-sm ${darkMode ? "text-neutral-400" : "text-slate-500"}`}>{description}</p>
      </div>
    </FadeInView>
  );
}

function StepCard({ number, title, description, darkMode }: { number: string; title: string; description: string; darkMode: boolean }) {
  return (
    <div className={`relative z-10 p-8 rounded-3xl transition-colors group ${darkMode ? "bg-neutral-900/50 border border-white/5 hover:border-indigo-500/30" : "bg-white border border-slate-200 hover:border-indigo-500/30 shadow-sm"}`}>
      <div className={`text-4xl font-black mb-4 group-hover:text-indigo-500/20 transition-colors ${darkMode ? "text-white/5" : "text-slate-200"}`}>{number}</div>
      <h3 className={`text-xl font-bold mb-3 tracking-tight ${darkMode ? "" : "text-slate-900"}`}>{title}</h3>
      <p className={`text-sm leading-relaxed ${darkMode ? "text-neutral-400" : "text-slate-500"}`}>{description}</p>
    </div>
  );
}

export default function LandingPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stats, setStats] = useState({ repos: 3, scans: 12, issues: 0, users: 5 });
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";
    }
    return true;
  });

  useEffect(() => {
    document.title = "InfraDoctor AI — GitHub Secret Scanner & Infrastructure Monitor";
    let meta = document.querySelector("meta[name='description']");
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "description"); document.head.appendChild(meta); }
    meta.setAttribute("content", "InfraDoctor AI scans your GitHub repos for hardcoded secrets, API keys, and sensitive files. Real-time dashboard with auto webhook scanning.");

    localStorage.setItem("theme", darkMode ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    fetch(`${API_BASE}/reviews/`)
      .then(r => r.json())
      .then(data => setReviews(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const navItems = [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Reviews", href: "#reviews" },
    { label: "Docs", href: "/docs", isLink: true },
  ];

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 ${darkMode ? "bg-neutral-950 text-white" : "bg-white text-slate-900"}`}>
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 border-b transition-colors duration-300 ${darkMode ? "border-white/5 bg-neutral-950/80 backdrop-blur-md" : "border-slate-200 bg-white/80 backdrop-blur-md"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">InfraDoctor<span className="text-indigo-500">AI</span></span>
          </Link>
          <div className={`hidden md:flex items-center gap-8 text-sm font-medium ${darkMode ? "text-neutral-400" : "text-slate-500"}`}>
            {navItems.map((item) =>
              item.isLink ? (
                <Link key={item.label} href={item.href} className={`transition-colors ${darkMode ? "hover:text-white" : "hover:text-slate-900"}`}>{item.label}</Link>
              ) : (
                <a key={item.label} href={item.href} className={`transition-colors ${darkMode ? "hover:text-white" : "hover:text-slate-900"}`}>{item.label}</a>
              )
            )}
          </div>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/login" className={`text-sm font-medium transition-colors ${darkMode ? "hover:text-white" : "hover:text-slate-900"}`}>Sign in</Link>
            <Link href="/register" className="px-5 py-2.5 bg-white text-black text-sm font-bold rounded-full hover:bg-neutral-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.15)]">Get Started</Link>
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-xl border transition-all ${darkMode ? "border-white/10 text-neutral-400 hover:text-white hover:border-white/20" : "border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-300"}`} title="Toggle theme">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
          <div className="flex md:hidden items-center gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-neutral-400 hover:text-white transition-colors">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 text-neutral-400 hover:text-white transition-colors" aria-label="Menu">
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        {mobileOpen && (
          <div className={`md:hidden border-t ${darkMode ? "border-white/5 bg-neutral-950/95 backdrop-blur-md" : "border-slate-200 bg-white/95 backdrop-blur-md"}`}>
            <div className="px-4 sm:px-6 py-4 space-y-3">
              {navItems.map((item) =>
                item.isLink ? (
                  <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${darkMode ? "text-neutral-400 hover:text-white hover:bg-white/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}>{item.label}</Link>
                ) : (
                  <a key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${darkMode ? "text-neutral-400 hover:text-white hover:bg-white/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}>{item.label}</a>
                )
              )}
              <hr className={darkMode ? "border-white/5" : "border-slate-200"} />
              <Link href="/login" onClick={() => setMobileOpen(false)} className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${darkMode ? "text-neutral-400 hover:text-white hover:bg-white/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}>Sign in</Link>
              <Link href="/register" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-bold text-center bg-white text-black hover:bg-neutral-200 transition-colors">Get Started</Link>
            </div>
          </div>
        )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full -z-10" />
        <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-purple-500/10 blur-[100px] rounded-full -z-10" />
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-bold tracking-widest uppercase mb-6 inline-block">
              Free GitHub Secret Scanner
            </span>
            <h1 className={`text-5xl md:text-7xl font-bold tracking-tight mb-8 ${darkMode ? "bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-500" : "text-slate-900"}`}>
              Scan Your GitHub Repos <br />
              for Secrets & Vulnerabilities.
            </h1>
            <p className={`text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed ${darkMode ? "text-neutral-400" : "text-slate-600"}`}>
              InfraDoctor AI automatically detects hardcoded API keys, passwords, tokens, and sensitive files in your GitHub repositories. Real-time dashboard with auto-scan on every push.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="group w-full sm:w-auto px-8 py-4 bg-indigo-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/25">
                Start Free Trial
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#features" className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-bold transition-all cursor-pointer ${darkMode ? "bg-white/5 border border-white/10 hover:bg-white/10" : "bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200"}`}>
                See Features
              </a>
            </div>
          </motion.div>

          {/* Dashboard Mock */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.8 }} className="mt-20 relative mx-auto max-w-5xl">
            <div className={`rounded-2xl border shadow-2xl overflow-hidden relative group ${darkMode ? "border-white/10 bg-neutral-900" : "border-slate-200 bg-slate-100"}`}>
              <div className="p-6 h-full flex flex-col gap-4">
                <div className={cn("flex items-center justify-between border-b pb-4", darkMode ? "border-white/5" : "border-slate-200")}>
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold">SECURE</span>
                    <span className={`text-xs font-mono ${darkMode ? "text-neutral-500" : "text-slate-400"}`}>Score: 100%</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Score", value: "100%", col: "text-green-500" },
                    { label: "Files", value: "145", col: "" },
                    { label: "Issues", value: "0", col: "text-green-500" },
                    { label: "Storage", value: "919 KB", col: "" },
                  ].map((s, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${darkMode ? "bg-neutral-950/50 border-white/5" : "bg-white border-slate-200"}`}>
                      <div className={`text-lg font-bold ${s.col ? s.col : darkMode ? "text-white" : "text-slate-900"}`}>{s.value}</div>
                      <div className={`text-[10px] ${darkMode ? "text-neutral-500" : "text-slate-400"}`}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${darkMode ? "bg-neutral-950/50 border-white/5" : "bg-white border-slate-200"}`}>
                  <FileWarning size={16} className="text-green-500" />
                  <span className={`text-xs ${darkMode ? "text-neutral-400" : "text-slate-500"}`}>No secrets found. Repo is secure.</span>
                  <span className="ml-auto text-[10px] text-indigo-500">View Details →</span>
                </div>
              </div>
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-10 group-hover:opacity-20 transition-opacity -z-10" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className={`py-16 border-t ${darkMode ? "border-white/5 bg-neutral-900/50" : "border-slate-200 bg-slate-50"}`}>
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "Free", label: "Pricing", icon: <Shield size={20} /> },
              { value: "30+", label: "Secret Patterns", icon: <Scan size={20} /> },
              { value: "Auto", label: "Webhook Scanning", icon: <Webhook size={20} /> },
              { value: "Real-time", label: "Dashboard", icon: <Activity size={20} /> },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="flex flex-col items-center gap-2">
              <div className={`${darkMode ? "text-indigo-400" : "text-indigo-600"}`}>{s.icon}</div>
              <div className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>{s.value}</div>
              <div className={`text-xs ${darkMode ? "text-neutral-500" : "text-slate-400"}`}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className={`py-24 ${darkMode ? "bg-neutral-950 border-t border-white/5" : "bg-white border-t border-slate-200"}`}>
        <div className="max-w-7xl mx-auto px-6">
          <FadeInView>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">What InfraDoctor Checks.</h2>
              <p className={darkMode ? "text-neutral-400" : "text-slate-500"}>Advanced secret detection for your GitHub repositories.</p>
            </div>
          </FadeInView>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard darkMode={darkMode} index={0}
              icon={<Lock className="w-6 h-6 text-indigo-400" />}
              title="Secret Detection"
              description="Detects API keys, passwords, tokens, AWS keys, GitHub tokens, Stripe keys, database URLs, and 30+ secret patterns in your code."
            />
            <FeatureCard darkMode={darkMode} index={1}
              icon={<FileWarning className="w-6 h-6 text-amber-400" />}
              title="Sensitive File Scanner"
              description="Flags .env, credentials, service-account.json, .pem keys, kubeconfig, and other sensitive files committed to your repository."
            />
            <FeatureCard darkMode={darkMode} index={2}
              icon={<BarChart3 className="w-6 h-6 text-green-400" />}
              title="Security Score"
              description="Auto-calculated security score (0-100) with remediation tips for each issue. Know exactly what to fix and how."
            />
            <FeatureCard darkMode={darkMode} index={3}
              icon={<Webhook className="w-6 h-6 text-purple-400" />}
              title="Auto-Scan on Push"
              description="GitHub webhook integration triggers automatic scans on every push. No manual rescan needed — secrets caught instantly."
            />
            <FeatureCard darkMode={darkMode} index={4}
              icon={<GitBranch className="w-6 h-6 text-neutral-400" />}
              title="Auto Issue Creation"
              description="When secrets are found, InfraDoctor automatically creates a GitHub issue with full details and step-by-step remediation."
            />
            <FeatureCard darkMode={darkMode} index={5}
              icon={<Activity className="w-6 h-6 text-blue-400" />}
              title="Real-time Dashboard"
              description="Overview, Security, Infrastructure, and Databases views with live WebSocket updates. Light and dark theme support."
            />
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className={`py-24 relative overflow-hidden ${darkMode ? "bg-neutral-950 border-t border-white/5" : "bg-slate-50 border-t border-slate-200"}`}>
        <div className="max-w-7xl mx-auto px-6">
          <FadeInView>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">How It Works.</h2>
              <p className={darkMode ? "text-neutral-400" : "text-slate-500"}>Three steps to secure your GitHub repositories.</p>
            </div>
          </FadeInView>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent hidden md:block -translate-y-1/2" />
            <FadeInView delay={0}><StepCard darkMode={darkMode} number="01" title="Add Repository" description="Connect your GitHub repo by pasting the URL. No complex setup — just add and scan." /></FadeInView>
            <FadeInView delay={0.15}><StepCard darkMode={darkMode} number="02" title="AI Scans for Secrets" description="Our scanner checks every file for hardcoded API keys, tokens, passwords, and sensitive filenames using 30+ regex patterns." /></FadeInView>
            <FadeInView delay={0.3}><StepCard darkMode={darkMode} number="03" title="Fix & Monitor" description="Get a security score, remediation steps for each issue, and auto-scan on every push via webhook." /></FadeInView>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-24 relative overflow-hidden ${darkMode ? "" : "bg-white"}`}>
        {darkMode && <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-indigo-950/10 to-neutral-950" />}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full" />
        <div className="max-w-3xl mx-auto px-6 text-center relative">
          <FadeInView>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Ready to secure your repos?</h2>
            <p className={`text-lg mb-10 ${darkMode ? "text-neutral-400" : "text-slate-500"}`}>Free to use. No credit card required. Start scanning in 30 seconds.</p>
            <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 rounded-2xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/25 text-white">
              Get Started Free
              <ChevronRight className="w-4 h-4" />
            </Link>
          </FadeInView>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className={`py-24 relative overflow-hidden ${darkMode ? "" : "bg-slate-50"}`}>
        {darkMode && <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-indigo-950/10 to-neutral-950" />}
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="text-center mb-16">
            <span className="px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-bold tracking-widest uppercase mb-6 inline-block">
              Testimonials
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Loved by developers.</h2>
          </div>
          {reviews.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-6">
              {reviews.map((review: any, idx: number) => {
                const colors = ["from-indigo-500 to-purple-600", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600", "from-blue-500 to-cyan-600", "from-rose-500 to-pink-600"];
                const c = colors[idx % colors.length];
                return (
                  <motion.div key={review.id || idx} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.12, duration: 0.6 }}
                    className={`w-full max-w-sm rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-lg ${darkMode ? "bg-neutral-900/80 backdrop-blur-sm border border-white/10 hover:border-indigo-500/40" : "bg-white border border-slate-200 hover:border-indigo-500/40 shadow-sm"}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c} flex items-center justify-center text-sm font-bold text-white shadow-lg`}>
                        {review.user_name?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${darkMode ? "text-white" : "text-slate-800"}`}>{review.user_name || "Anonymous"}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={12} className={s <= review.rating ? "text-amber-400 fill-amber-400" : "text-neutral-600"} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className={`text-sm leading-relaxed ${darkMode ? "text-neutral-400" : "text-slate-500"}`}>&ldquo;{review.comment}&rdquo;</p>
                    <p className={`text-xs mt-3 italic ${darkMode ? "text-neutral-600" : "text-slate-400"}`}>— {review.title || "Verified User"}</p>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1,2,3].map((_, idx) => (
                <div key={idx} className={`rounded-2xl p-6 animate-pulse ${darkMode ? "bg-neutral-900/50 border border-white/5" : "bg-white border border-slate-200"}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5" />
                    <div className="flex-1"><div className="h-3 w-20 bg-white/5 rounded mb-2" /><div className="h-2 w-16 bg-white/5 rounded" /></div>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded mb-2" /><div className="h-3 w-5/6 bg-white/5 rounded mb-2" /><div className="h-3 w-4/6 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          )}
          <div className="text-center mt-12">
            <Link href="/dashboard" className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${darkMode ? "bg-white/5 border border-white/10 hover:bg-white/10" : "bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200"}`}>
              <MessageCircle size={16} />
              Share your review
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`mt-auto border-t py-12 ${darkMode ? "border-white/5 bg-neutral-950" : "border-slate-200 bg-white"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            <span className="text-lg font-bold tracking-tight">InfraDoctor<span className="text-indigo-500">AI</span></span>
          </div>
          <div className={`text-sm text-center md:text-left ${darkMode ? "text-neutral-500" : "text-slate-400"}`}>
            © 2026 InfraDoctor AI Inc. Free GitHub secret scanner.
          </div>
          <div className={`flex gap-6 ${darkMode ? "text-neutral-400" : "text-slate-400"}`}>
            <a href="https://github.com/AYAN766666/infradoctor-ai" target="_blank" rel="noopener noreferrer" className={`transition-colors flex items-center gap-1.5 ${darkMode ? "hover:text-white" : "hover:text-slate-700"}`}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
