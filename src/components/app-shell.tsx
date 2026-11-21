"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Plus, FolderOpen, Settings, LogOut, Menu, X, Sparkles, Clapperboard,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { CLOUD_APP_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ user, children }: { user: { name: string; email: string }; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hosted, setHosted] = useState(false);
  const initial = user.name.charAt(0).toUpperCase();

  useEffect(() => {
    setHosted(process.env.NEXT_PUBLIC_HOSTED_MODE === "true" || window.location.hostname.endsWith(".vercel.app"));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-6 py-6"><Logo /></div>
      <div className="px-4">
        {hosted ? <a href={`${CLOUD_APP_URL}/projects/new`} onClick={() => setOpen(false)} className="btn-primary w-full"><Plus className="h-4 w-4" /> Open full app</a> : <Link href="/projects/new" onClick={() => setOpen(false)} className="btn-primary w-full"><Plus className="h-4 w-4" /> New project</Link>}
      </div>
      <nav className="mt-8 flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = path === item.href || path.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
              className={cn("relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                active ? "bg-violet-500/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white")}>
              {active && <motion.span layoutId="nav-active" className="absolute left-0 top-2 h-8 w-1 rounded-full bg-gradient-to-b from-violet-400 to-blue-500" />}
              <item.icon className={cn("h-[18px] w-[18px]", active && "text-violet-300")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mx-4 mb-4 rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-blue-500/5 p-4">
        <Sparkles className="h-5 w-5 text-violet-300" />
        <p className="mt-2 text-xs font-semibold text-white">Pro workflow</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Local processing. Your videos never leave your machine unless you choose cloud storage.</p>
      </div>
      <div className="border-t border-white/5 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-blue-600 text-sm font-bold text-white">{initial}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-[11px] text-slate-500">{user.email}</p>
          </div>
          <button onClick={logout} aria-label="Sign out" className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-white/[0.07] bg-[#080a14]/90 backdrop-blur-xl lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-[270px] border-r border-white/10 bg-[#080a14]"><button onClick={() => setOpen(false)} className="absolute right-3 top-4 z-10 rounded-lg p-2 text-slate-400"><X className="h-5 w-5" /></button>{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#05060d]/80 px-4 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-lg p-3 text-slate-300 lg:hidden"><Menu className="h-5 w-5" /></button>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400"><Clapperboard className="h-4 w-4 text-violet-400" /> AI video workspace</div>
          </div>
          {hosted ? <a href={`${CLOUD_APP_URL}/projects/new`} className="hidden items-center gap-2 rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20 sm:inline-flex"><Plus className="h-3.5 w-3.5" /> Open full app</a> : <Link href="/projects/new" className="hidden items-center gap-2 rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20 sm:inline-flex"><Plus className="h-3.5 w-3.5" /> Create</Link>}
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
