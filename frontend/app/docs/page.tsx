"use client";

import { useState } from "react";
import { Activity, Shield, ArrowLeft, AlertTriangle, Code, Users, Target, Zap, Server, Eye, BookOpen } from "lucide-react";
import Link from "next/link";

const en = {
  badge: "Documentation",
  subtitle: "Find security issues before they become real problems.",
  why: "Why I Built This",
  why1: "As a developer, I realized that one small mistake can turn into a serious security incident.",
  why2: "Every year, thousands of API keys, access tokens, database passwords, and cloud credentials are accidentally committed to GitHub repositories. This doesn't only happen to beginners it has also affected startups, open-source projects, and even large organizations.",
  why3: "In the past, security incidents involving exposed credentials have led to data breaches, financial losses, and unauthorized access to cloud infrastructure. That's why platforms like GitHub now provide Secret Scanning to help developers detect leaked credentials.",
  why4: "Despite these improvements, many developers still don't realize their secrets have been exposed until someone reports the issue or an incident occurs.",
  why5: "Manually reviewing hundreds or thousands of files is slow, repetitive, and easy to get wrong.",
  why6: "That's why I built InfraDoctor AI.",
  problem: "The Problem",
  problem1: "Imagine you're building a project and pushing code to GitHub every day.",
  problem2: "During development, you accidentally commit:",
  items: [
    "An OpenAI API Key",
    "An AWS Access Key",
    "A GitHub Personal Access Token",
    "A Database Password",
    "A Stripe Secret Key",
  ],
  problem3: "The project works perfectly, so you continue developing.",
  problem4: "Days or even weeks later, you discover that the secret was committed to your repository.",
  problem5: "This type of mistake has happened in real-world software projects and has resulted in compromised accounts, cloud resource abuse, unexpected costs, and security incidents.",
  problem6: "The impact can include:",
  impacts: ["Financial loss", "API abuse", "Data breaches", "Infrastructure compromise", "Service downtime"],
  problem7: "Most developers don't intentionally expose secrets they simply don't notice them in time.",
  solution: "The Solution",
  solution1: "InfraDoctor AI automatically scans GitHub repositories and performs AI-powered security analysis.",
  solution2: "Instead of manually checking every file, developers simply provide a GitHub repository URL.",
  solution3: "InfraDoctor AI analyzes the repository, detects exposed secrets, calculates a Security Score, and generates a complete security report within minutes.",
  solution4: "It doesn't just tell you what is wrong it explains why the issue matters and how to fix it.",
  does: "What InfraDoctor AI Does",
  does1: "After adding a GitHub repository, InfraDoctor AI automatically:",
  doesItems: [
    "Scans the entire repository",
    "Counts total files",
    "Calculates repository size",
    "Detects exposed API keys, passwords, and secrets",
    "Identifies security risks",
    "Generates a Security Score",
    "Explains every issue using AI",
    "Provides step-by-step remediation guidance",
    "Creates a detailed security report",
  ],
  diff: "Why It Is Different",
  diff1: "Many security scanners only report problems.",
  diff2: "InfraDoctor AI goes one step further by helping developers understand:",
  diffItems: [
    "Why an issue is dangerous",
    "What impact it can have",
    "How to fix it",
    "Best security practices to prevent similar mistakes in the future",
  ],
  diff3: "Instead of spending hours searching documentation, developers get practical AI-powered guidance in one place.",
  who: "Who Is It For?",
  whoItems: ["Developers", "Freelancers", "Startups", "Software Houses", "DevOps Engineers", "Security Teams", "Students learning secure software development"],
  goal: "My Goal",
  goal1: "My goal is simple.",
  goal2: "I want to make repository security easy, fast, and accessible for every developer.",
  goal3: "Developers should focus on building great software not worrying about hidden secrets or manually reviewing thousands of lines of code.",
  goal4: "InfraDoctor AI helps detect security issues early, explains them clearly, and provides practical solutions before they become real security incidents.",
  footer: "Keep your code safe. Every commit matters.",
};

const ur = {
  badge: "دستاویز",
  subtitle: "Security issues ko real problem banne se pehle pakdo.",
  why: "Maine Yeh Kyun Banaya",
  why1: "Ek developer ke tor par, mujhe ehsaas hua ke ek chhoti si ghalti bari security incident ban sakti hai.",
  why2: "Har saal, hazaaron API keys, access tokens, database passwords, aur cloud credentials accidentally GitHub repos mein commit ho jate hain. Yeh sirf beginners ke saath nahi hota startups, open-source projects, aur bari organizations bhi iska shikar hoti hain.",
  why3: "Past mein, exposed credentials ki wajah se data breaches, financial losses, aur unauthorized access jaisi incidents hui hain. Isliye platforms jaise GitHub ne Secret Scanning introduce ki hai.",
  why4: "In improvements ke bawajood, bhot se developers ko pata nahi chalta ke unke secrets expose ho chuke hain jab tak koi report nahi karta ya incident nahi hota.",
  why5: "Hundreds ya thousands files ko manually review karna slow, repetitive, aur error-prone hai.",
  why6: "Isliye maine InfraDoctor AI banaya.",
  problem: "Problem",
  problem1: "Socho aap ek project bana rahe ho aur har din GitHub pe code push kar rahe ho.",
  problem2: "Development ke doran, aap accidentally commit kar dete ho:",
  items: [
    "OpenAI API Key",
    "AWS Access Key",
    "GitHub Personal Access Token",
    "Database Password",
    "Stripe Secret Key",
  ],
  problem3: "Project perfectly kaam karta hai, to aap develop karte rehte ho.",
  problem4: "Din ya hafton baad, aapko pata chalta hai ke secret repo mein commit ho chuka tha.",
  problem5: "Is tarah ki ghalti real-world projects mein hui hai aur iske results hain compromised accounts, cloud resource abuse, unexpected costs, aur security incidents.",
  problem6: "Iske impacts mein shamil hain:",
  impacts: ["Financial loss", "API abuse", "Data breaches", "Infrastructure compromise", "Service downtime"],
  problem7: "Ziyada tar developers deliberately secrets expose nahi karte woh bas time par notice nahi kar pate.",
  solution: "Solution",
  solution1: "InfraDoctor AI automatically GitHub repos ko scan karta hai aur AI-powered security analysis karta hai.",
  solution2: "Har file manually check karne ke bajaye, developers sirf GitHub repository URL provide karte hain.",
  solution3: "InfraDoctor AI repo analyze karta hai, exposed secrets detect karta hai, Security Score calculate karta hai, aur minutes mein complete security report generate karta hai.",
  solution4: "Yeh sirf yeh nahi batata ke kya galat hai yeh yeh bhi batata hai ke issue kyun important hai aur kaise fix karna hai.",
  does: "InfraDoctor AI Kya Karta Hai",
  does1: "GitHub repository add karne ke baad, InfraDoctor AI automatically:",
  doesItems: [
    "Poori repo scan karta hai",
    "Total files count karta hai",
    "Repository size calculate karta hai",
    "Exposed API keys, passwords, aur secrets detect karta hai",
    "Security risks identify karta hai",
    "Security Score generate karta hai",
    "Har issue ko AI ki madad se explain karta hai",
    "Step-by-step remediation guidance provide karta hai",
    "Detailed security report banata hai",
  ],
  diff: "Yeh Kyon Alag Hai",
  diff1: "Bhot sare security scanners sirf problems report karte hain.",
  diff2: "InfraDoctor AI ek step aage badh kar developers ko samajhne mein madad karta hai:",
  diffItems: [
    "Issue dangerous kyun hai",
    "Iska kya impact ho sakta hai",
    "Ise kaise fix karein",
    "Best security practices taake future mein aisi ghaltiyan na hon",
  ],
  diff3: "Documentation dhundhne ke ghante barbaad karne ke bajaye, developers ko ek jagah practical AI-powered guidance milti hai.",
  who: "Yeh Kis Ke Liye Hai?",
  whoItems: ["Developers", "Freelancers", "Startups", "Software Houses", "DevOps Engineers", "Security Teams", "Students jo secure software development seekh rahe hain"],
  goal: "Mera Maqsad",
  goal1: "Mera maqsad simple hai.",
  goal2: "Main chahta hoon ke repository security har developer ke liye easy, fast, aur accessible ho.",
  goal3: "Developers ko great software banane par focus karna chahiye hidden secrets ya hazaaron lines of code manually review karne ki fikr nahi karni chahiye.",
  goal4: "InfraDoctor AI security issues ko early detect karta hai, clearly explain karta hai, aur practical solutions provide karta hai is se pehle ke woh real security incidents ban jayein.",
  footer: "Apne code ko safe rakho. Har ek commit matter karta hai.",
};

export default function DocsPage() {
  const [lang, setLang] = useState<"en" | "ur">("en");
  const isUrdu = lang === "ur";

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <nav className="border-b border-white/5 bg-neutral-950/80 backdrop-blur-md fixed top-0 w-full z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">InfraDoctor<span className="text-indigo-500">AI</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex bg-white/5 rounded-full p-0.5 border border-white/10">
              <button
                onClick={() => setLang("en")}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${!isUrdu ? "bg-indigo-600 text-white" : "text-neutral-400 hover:text-white"}`}
              >English</button>
              <button
                onClick={() => setLang("ur")}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${isUrdu ? "bg-indigo-600 text-white" : "text-neutral-400 hover:text-white"}`}
              >Roman Urdu</button>
            </div>
            <Link href="/" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
              <ArrowLeft size={16} /> Back
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20 max-w-4xl mx-auto px-6">
        {isUrdu ? <Content t={ur} /> : <Content t={en} />}
      </div>
    </div>
  );
}

function Content({ t }: { t: typeof en }) {
  return (
    <>
      <div className="mb-12">
        <span className="px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-bold tracking-widest uppercase mb-6 inline-block">{t.badge}</span>
        <h1 className="text-5xl font-bold tracking-tight mb-3 flex items-center gap-3">
          <Shield className="text-indigo-500" size={36} />
          InfraDoctor <span className="text-indigo-500">AI</span>
        </h1>
        <p className="text-lg text-neutral-400 italic border-l-4 border-indigo-500/50 pl-4">{t.subtitle}</p>
      </div>

      <Section icon={<Code size={18} />} title={t.why} color="text-indigo-400">
        <p>{t.why1}</p>
        <p>{t.why2}</p>
        <p>{t.why3}</p>
        <p>{t.why4}</p>
        <p>{t.why5}</p>
        <p className="text-indigo-400 font-bold">{t.why6}</p>
      </Section>

      <Section icon={<AlertTriangle size={18} />} title={t.problem} color="text-red-400">
        <p>{t.problem1}</p>
        <p>{t.problem2}</p>
        <ul className="list-disc list-inside space-y-1 text-neutral-300">
          {t.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
        <p>{t.problem3}</p>
        <p>{t.problem4}</p>
        <p>{t.problem5}</p>
        <p>{t.problem6}</p>
        <ul className="list-disc list-inside space-y-1 text-neutral-300">
          {t.impacts.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
        <p className="text-amber-400 font-bold">{t.problem7}</p>
      </Section>

      <Section icon={<Zap size={18} />} title={t.solution} color="text-yellow-400">
        <p>{t.solution1}</p>
        <p>{t.solution2}</p>
        <p>{t.solution3}</p>
        <p className="text-green-400 font-bold">{t.solution4}</p>
      </Section>

      <Section icon={<Server size={18} />} title={t.does} color="text-blue-400">
        <p>{t.does1}</p>
        <ul className="list-disc list-inside space-y-1 text-neutral-300">
          {t.doesItems.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </Section>

      <Section icon={<Eye size={18} />} title={t.diff} color="text-purple-400">
        <p>{t.diff1}</p>
        <p>{t.diff2}</p>
        <ul className="list-disc list-inside space-y-1 text-neutral-300">
          {t.diffItems.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
        <p className="text-purple-300">{t.diff3}</p>
      </Section>

      <Section icon={<Users size={18} />} title={t.who} color="text-cyan-400">
        <div className="flex flex-wrap gap-2">
          {t.whoItems.map((item, i) => (
            <span key={i} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-neutral-300">{item}</span>
          ))}
        </div>
      </Section>

      <div className="bg-gradient-to-br from-indigo-600/10 to-purple-600/10 border border-indigo-500/10 rounded-2xl p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Target size={18} className="text-indigo-400" /> {t.goal}</h2>
        <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
          <p className="text-lg text-white font-bold">{t.goal1}</p>
          <p>{t.goal2}</p>
          <p>{t.goal3}</p>
          <p className="text-indigo-300">{t.goal4}</p>
        </div>
      </div>

      <div className="border-t border-white/5 mt-12 pt-8 text-center text-sm text-neutral-500">
        {t.footer}
      </div>
    </>
  );
}

function Section({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 mb-6">
      <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
        <span className={color}>{icon}</span>
        {title}
      </h2>
      <div className="space-y-3 text-sm text-neutral-400 leading-relaxed">
        {children}
      </div>
    </div>
  );
}
