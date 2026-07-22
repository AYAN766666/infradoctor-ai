"use client";

import { motion } from "framer-motion";
import { 
  Activity, 
  Shield, 
  Zap, 
  BarChart3, 
  ChevronRight, 
  Terminal,
  Cpu,
  Globe,
  CheckCircle2,
  Star,
  MessageCircle,
  Quote
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

// ... existing LandingPage export ...

function StepCard({ number, title, description }: { number: string, title: string, description: string }) {
  return (
    <div className="relative z-10 p-8 rounded-3xl bg-neutral-900/50 border border-white/5 hover:border-indigo-500/30 transition-colors group">
      <div className="text-4xl font-black text-white/5 mb-4 group-hover:text-indigo-500/20 transition-colors">{number}</div>
      <h3 className="text-xl font-bold mb-3 tracking-tight">{title}</h3>
      <p className="text-neutral-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function PriceCard({ tier, price, description, features, featured = false }: { tier: string, price: string, description: string, features: string[], featured?: boolean }) {
  return (
    <div className={cn(
      "p-8 rounded-3xl border transition-all hover:-translate-y-1",
      featured 
        ? "bg-indigo-600 border-indigo-500 shadow-2xl shadow-indigo-500/20 scale-105" 
        : "bg-neutral-900/50 border-white/5 hover:bg-neutral-900"
    )}>
      <h3 className="text-lg font-bold mb-2 tracking-tight">{tier}</h3>
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-4xl font-bold tracking-tight">${price}</span>
        {price !== "Custom" && <span className={cn("text-sm", featured ? "text-indigo-200" : "text-neutral-500")}>/mo</span>}
      </div>
      <p className={cn("text-sm mb-8", featured ? "text-indigo-100" : "text-neutral-400")}>{description}</p>
      
      <div className="space-y-4 mb-8">
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <CheckCircle2 className={cn("w-4 h-4", featured ? "text-white" : "text-indigo-500")} />
            <span>{f}</span>
          </div>
        ))}
      </div>

      <button className={cn(
        "w-full py-3 rounded-xl font-bold text-sm transition-all",
        featured 
          ? "bg-white text-indigo-600 hover:bg-neutral-100" 
          : "bg-white/5 border border-white/10 hover:bg-white/10"
      )}>
        Get Started
      </button>
    </div>
  );
}

export default function LandingPage() {
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    fetch("http://localhost:8000/reviews/")
      .then(r => r.json())
      .then(data => setReviews(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-neutral-950 text-white selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">InfraDoctor<span className="text-indigo-500">AI</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#reviews" className="hover:text-white transition-colors">Reviews</a>
            <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-white transition-colors">
              Sign in
            </Link>
            <Link 
              href="/register" 
              className="px-4 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-neutral-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.15)]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full -z-10" />
        <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-purple-500/10 blur-[100px] rounded-full -z-10" />

        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-bold tracking-widest uppercase mb-6 inline-block">
              Next-Gen Infrastructure Monitoring
            </span>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-500">
              Your Infrastructure, <br />
              Healed by Intelligence.
            </h1>
            <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              InfraDoctor AI predicts incidents before they happen, automates root cause analysis, and heals your cloud infrastructure with advanced AI agents.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/register"
                className="group w-full sm:w-auto px-8 py-4 bg-indigo-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/25"
              >
                Start Free Trial
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all">
                Book a Demo
              </button>
            </div>
          </motion.div>

          {/* Feature Grid Preview / Dashboard Image Mockup */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-20 relative mx-auto max-w-5xl"
          >
            <div className="rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl overflow-hidden aspect-video relative group">
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent opacity-60" />
              
              {/* Mock Dashboard Content */}
              <div className="p-8 h-full flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>
                  <div className="text-xs text-neutral-500 font-mono tracking-wider uppercase">System Health: 99.8%</div>
                </div>
                <div className="grid grid-cols-3 gap-6 flex-1">
                  <div className="col-span-2 bg-neutral-950/50 rounded-xl border border-white/5 p-4 flex flex-col gap-4">
                    <div className="h-4 w-1/4 bg-white/10 rounded" />
                    <div className="flex-1 flex items-end gap-1">
                      {[40, 60, 45, 90, 65, 80, 50, 75, 40, 85].map((h, i) => (
                        <div key={i} className="flex-1 bg-indigo-500/40 rounded-t-sm" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-neutral-950/50 rounded-xl border border-white/5" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Glowing Overlay */}
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-10 group-hover:opacity-20 transition-opacity -z-10" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-neutral-950 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">Everything you need to scale.</h2>
            <p className="text-neutral-400">Advanced tools for modern engineering teams.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Shield className="w-6 h-6 text-indigo-400" />}
              title="Security First"
              description="Zero-trust architecture with automated vulnerability scanning and threat detection."
            />
            <FeatureCard 
              icon={<Zap className="w-6 h-6 text-yellow-400" />}
              title="Real-time Alerts"
              description="Sub-second latency in monitoring and incident triggering across your entire stack."
            />
            <FeatureCard 
              icon={<BarChart3 className="w-6 h-6 text-green-400" />}
              title="Predictive Analytics"
              description="Our AI models predict potential failures up to 2 hours before they impact users."
            />
            <FeatureCard 
              icon={<Terminal className="w-6 h-6 text-neutral-400" />}
              title="Automated Remediation"
              description="Self-healing infrastructure that applies patches and scales resources automatically."
            />
            <FeatureCard 
              icon={<Cpu className="w-6 h-6 text-purple-400" />}
              title="Kubernetes Native"
              description="Deep integration with K8s clusters for granular pod and node-level visibility."
            />
            <FeatureCard 
              icon={<Globe className="w-6 h-6 text-blue-400" />}
              title="Global Observability"
              description="Monitor multi-cloud and hybrid environments from a single unified control plane."
            />
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-24 bg-neutral-950 border-t border-white/5 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">Three steps to health.</h2>
            <p className="text-neutral-400">Our AI agents work around the clock so you don&apos;t have to.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent hidden md:block -translate-y-1/2" />
            
            <StepCard 
              number="01"
              title="Connect Sources"
              description="Connect your AWS, GCP, Azure, or Kubernetes clusters in minutes via our secure agent."
            />
            <StepCard 
              number="02"
              title="AI Discovery"
              description="Our models map your infrastructure and establish baseline performance metrics automatically."
            />
            <StepCard 
              number="03"
              title="Auto-Healing"
              description="Sit back as InfraDoctor predicts, alerts, and resolves incidents in real-time."
            />
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section id="reviews" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-indigo-950/10 to-neutral-950" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full" />
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
                  <motion.div
                    key={review.id || idx}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.12, duration: 0.6 }}
                    className="w-full max-w-sm bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-indigo-500/40 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/5"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c} flex items-center justify-center text-sm font-bold text-white shadow-lg`}>
                        {review.user_name?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{review.user_name || "Anonymous"}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={12} className={s <= review.rating ? "text-amber-400 fill-amber-400" : "text-neutral-600"} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-400 leading-relaxed">&ldquo;{review.comment}&rdquo;</p>
                    <p className="text-xs text-neutral-600 mt-3 italic">— {review.title || "Verified User"}</p>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1,2,3].map((_, idx) => (
                <div key={idx} className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5" />
                    <div className="flex-1">
                      <div className="h-3 w-20 bg-white/5 rounded mb-2" />
                      <div className="h-2 w-16 bg-white/5 rounded" />
                    </div>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded mb-2" />
                  <div className="h-3 w-5/6 bg-white/5 rounded mb-2" />
                  <div className="h-3 w-4/6 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          )}
          <div className="text-center mt-12">
            <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-sm hover:bg-white/10 transition-all">
              <MessageCircle size={16} />
              Share your review
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 py-12 bg-neutral-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            <span className="text-lg font-bold tracking-tight">InfraDoctor<span className="text-indigo-500">AI</span></span>
          </div>
          <div className="text-neutral-500 text-sm">
            © 2026 InfraDoctor AI Inc. Built for the modern cloud.
          </div>
          <div className="flex gap-6 text-neutral-400">
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="group p-8 rounded-3xl border border-white/5 bg-neutral-900/50 hover:bg-neutral-900 transition-all hover:-translate-y-1">
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 tracking-tight">{title}</h3>
      <p className="text-neutral-400 leading-relaxed text-sm">
        {description}
      </p>
    </div>
  );
}
