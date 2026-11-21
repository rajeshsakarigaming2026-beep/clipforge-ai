"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, AtSign, Lock, User, Sparkles, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand";
import { BackgroundFX } from "@/components/background";

export function AuthForm({ mode, notice }: { mode: "login" | "signup"; notice?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleHref = `/api/auth/google?mode=${mode}&silent=1${email ? `&hint=${encodeURIComponent(email)}` : ""}`;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { name, email, password } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-12">
      <BackgroundFX />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="mb-8 text-center"><Logo /><h1 className="mt-8 text-3xl font-bold text-white">{mode === "login" ? "Welcome back" : "Create your workspace"}</h1><p className="mt-2 text-sm text-slate-400">{mode === "login" ? "Sign in to continue editing clips." : "Start turning long videos into shorts."}</p></div>
        <form onSubmit={submit} className="glass-strong rounded-2xl p-6 shadow-2xl sm:p-8">
          <a href={googleHref} className="btn-secondary w-full justify-center"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-[#4285F4]">G</span> Continue with Google</a>
          <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600"><span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" /></div>
          {notice && <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{notice}</div>}
          {mode === "signup" && (
            <div className="mb-4"><label className="label">Full name</label><div className="relative"><User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input className="input !pl-11" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Creator" required minLength={2} /></div></div>
          )}
          <div className="mb-4"><label className="label">Email</label><div className="relative"><AtSign className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input className="input !pl-11" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div></div>
          <div className="mb-6"><label className="label">Password</label><div className="relative"><Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input className="input !pl-11" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} required minLength={mode === "signup" ? 8 : 1} /></div></div>
          {error && <div className="mb-4 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"} <ArrowRight className="h-4 w-4" /></button>
          <p className="mt-6 text-center text-sm text-slate-400">{mode === "login" ? "New here? " : "Already have an account? "}<Link href={mode === "login" ? "/signup" : "/login"} className="font-semibold text-violet-300 hover:text-violet-200">{mode === "login" ? "Create an account" : "Sign in"}</Link></p>
        </form>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500"><Sparkles className="h-3.5 w-3.5 text-violet-400" /><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Local processing · no credit card</div>
        <p className="mt-4 text-center text-xs text-slate-600"><Link href="/" className="hover:text-slate-400">← Back to home</Link></p>
      </motion.div>
    </div>
  );
}
