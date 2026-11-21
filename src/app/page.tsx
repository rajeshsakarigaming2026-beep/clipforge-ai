"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Play, Sparkles, Wand2, Scissors, Captions, ScanFace, Gauge, Download,
  Layers3, Check, ChevronDown, Menu, X, Zap, ShieldCheck, Clapperboard, Video,
  AudioLines, LayoutGrid, Rocket, Star,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { BackgroundFX } from "@/components/background";
import { PurchaseModal } from "@/components/purchase-modal";
import { DEFAULT_SITE, type SiteData } from "@/lib/site";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const features = [
  { icon: Wand2, title: "AI moment detection", text: "Whisper transcription, energy spikes and scene changes combine to find the moments your audience actually cares about.", color: "from-violet-500 to-fuchsia-500" },
  { icon: ScanFace, title: "Smart facecam framing", text: "Detects the streamer's face and automatically builds a facecam-plus-gameplay 9:16 layout. Adjust it by hand anytime.", color: "from-blue-500 to-cyan-400" },
  { icon: Captions, title: "Word-by-word captions", text: "Karaoke-style subtitles with highlighted keywords, custom fonts and colors baked directly into the render.", color: "from-fuchsia-500 to-pink-500" },
  { icon: Scissors, title: "Real video editing", text: "Trim, reframe, change captions, adjust speed and re-render. FFmpeg does the work on real MP4 files.", color: "from-amber-500 to-orange-500" },
  { icon: AudioLines, title: "Studio audio", text: "Every clip is loudness-normalised to -14 LUFS so it sounds right on phones, headphones and car speakers.", color: "from-emerald-500 to-teal-400" },
  { icon: Download, title: "Ready to post", text: "1080×1920 H.264 MP4s with faststart, thumbnails and one-click download of the whole set.", color: "from-indigo-500 to-violet-500" },
];

const steps = [
  { n: "01", title: "Bring your video", text: "Paste a public, accessible video URL or upload an authorized recording from your computer.", icon: Video },
  { n: "02", title: "AI listens & picks", text: "Speech-to-text, volume analysis and scene changes locate 3–4 high-potential moments.", icon: Gauge },
  { n: "03", title: "Auto-edit to 9:16", text: "Each moment gets facecam framing, animated captions, a title bar and cleaned audio.", icon: Layers3 },
  { n: "04", title: "Tweak & publish", text: "Preview in the editor, make it yours, then download clips ready for every platform.", icon: Rocket },
];

const faqs = [
  { q: "Do I need an API key?", a: "No. Speech-to-text and highlight detection run locally with Whisper and FFmpeg when the Python runtime is installed. You can optionally connect an AI provider for smarter titles in Settings." },
  { q: "Can you process a livestream that is still running?", a: "Only recorded or currently accessible segments can be processed. CLIPFORGE does not bypass Video restrictions, logins or DRM. Wait for the stream to finish, or upload a recording you are authorized to edit." },
  { q: "What does the facecam layout do?", a: "A face detector finds the streamer in the frame. For gameplay streams it puts the facecam on top and gameplay below. For talking-head videos it follows the face with a vertical crop. You can override every value in the editor." },
  { q: "Are the clips really rendered?", a: "Yes. The worker cuts the source with FFmpeg, transcribes with faster-whisper, builds ASS caption overlays, reframes to 1080×1920, normalizes audio and encodes H.264/AAC MP4 files." },
  { q: "Where are my files stored?", a: "By default everything stays in the local storage folder on the machine running the app. Set STORAGE_DRIVER=s3 and the S3 environment variables to use S3-compatible object storage instead." },
];

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [menu, setMenu] = useState(false);
  const [site, setSite] = useState<SiteData>(DEFAULT_SITE);
  const [purchasePlan, setPurchasePlan] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/site").then((r) => r.json()).then((d) => { if (d.site) setSite(d.site); }).catch(() => undefined);
  }, []);

  const openPurchase = useCallback((plan: string) => setPurchasePlan(plan), []);

  return (
    <div className="min-h-screen overflow-hidden">
      <BackgroundFX />

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#05060d]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#how" className="transition hover:text-white">How it works</a>
            <a href="#pricing" className="transition hover:text-white">Pricing</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/login" className="text-sm font-medium text-slate-300 transition hover:text-white">Sign in</Link>
            <Link href="/signup" className="btn-primary !px-4 !py-2 text-xs">Start free <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <button className="rounded-lg p-2 text-slate-300 md:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {menu && (
          <div className="border-t border-white/5 bg-[#080a14] px-5 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-sm text-slate-300">
              <a href="#features" onClick={() => setMenu(false)}>Features</a><a href="#how" onClick={() => setMenu(false)}>How it works</a><a href="#pricing" onClick={() => setMenu(false)}>Pricing</a>
              <Link href="/login">Sign in</Link><Link href="/signup" className="btn-primary mt-2">Start free</Link>
            </div>
          </div>
        )}
      </header>

      <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div initial="hidden" animate="show" variants={fadeUp} className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold text-violet-200">
            <Sparkles className="h-3.5 w-3.5" /> AI VIDEO WORKSPACE · BUILT FOR CREATORS
          </motion.div>
          <motion.h1 initial="hidden" animate="show" variants={{ ...fadeUp, show: { ...fadeUp.show, transition: { delay: 0.08, duration: 0.7 } } }} className="text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-[68px]">
            {site.heroTitle}
          </motion.h1>
          <motion.p initial="hidden" animate="show" variants={{ ...fadeUp, show: { ...fadeUp.show, transition: { delay: 0.16 } } }} className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            {site.heroSubtitle}
          </motion.p>
          <motion.div initial="hidden" animate="show" variants={{ ...fadeUp, show: { ...fadeUp.show, transition: { delay: 0.24 } } }} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn-primary w-full sm:w-auto">Start Creating Free <ArrowRight className="h-4 w-4" /></Link>
            <a href="#how" className="btn-secondary w-full sm:w-auto"><Play className="h-4 w-4" /> Explore Features</a>
          </motion.div>
          <p className="mt-4 text-xs text-slate-500"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" /> Runs locally · No API key required · Your files stay yours</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.8 }} className="relative mx-auto mt-16 max-w-6xl">
          <div className="absolute -inset-10 -z-10 rounded-full bg-violet-600/10 blur-[100px]" />
          <div className="glass rounded-[28px] p-3 shadow-2xl sm:p-5">
            <div className="flex items-center gap-2 px-2 pb-4 pt-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              <span className="ml-3 text-xs text-slate-500">pipeline.clipforge.ai / live-analysis</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.35fr_auto_1fr]">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#101730] to-[#080b18] p-4">
                <div className="flex items-center justify-between text-[11px] text-slate-400"><span>SOURCE · 16:9 LIVESTREAM</span><span className="text-emerald-300">● analyzing</span></div>
                <div className="relative mt-3 aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-indigo-900/60 via-slate-900 to-fuchsia-900/40">
                  <div className="absolute inset-0 animate-grid opacity-60" />
                  <div className="absolute left-4 top-4 h-16 w-24 rounded-lg border border-white/10 bg-gradient-to-br from-violet-500/40 to-transparent" />
                  <div className="absolute bottom-6 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border-2 border-white/20 bg-gradient-to-br from-cyan-400/30 to-violet-600/30 blur-[1px]" />
                  <motion.div animate={{ left: ["18%", "48%", "72%", "30%", "18%"] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/2 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent shadow-[0_0_18px_#e879f9]" />
                  <div className="absolute inset-x-4 bottom-3 flex items-center gap-2 rounded-lg bg-black/50 px-3 py-2 text-[10px] text-slate-300 backdrop-blur"><AudioLines className="h-3 w-3 text-violet-300" /> transcribing · 01:24:16 / 02:10:00</div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                  {[["SPEECH", "18.4k words"], ["ENERGY", "142 spikes"], ["SCENES", "67 changes"]].map(([k, v]) => <div key={k} className="rounded-lg border border-white/5 bg-white/[0.03] p-2"><p className="text-slate-500">{k}</p><p className="mt-0.5 font-semibold text-slate-200">{v}</p></div>)}
                </div>
              </div>

              <div className="flex items-center justify-center py-2 lg:py-0">
                <motion.div animate={{ x: [0, 8, 0] }} transition={{ duration: 2.4, repeat: Infinity }} className="grid h-11 w-11 place-items-center rounded-full border border-violet-400/30 bg-violet-500/15 text-violet-200 shadow-glow"><ArrowRight className="h-5 w-5 rotate-90 lg:rotate-0" /></motion.div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { t: "0:42", label: "UNREAL REACTION", score: 96, c: "from-fuchsia-500/40 to-violet-700/40" },
                  { t: "18:07", label: "THE CLUTCH PLAY", score: 91, c: "from-blue-500/40 to-cyan-700/40" },
                  { t: "53:21", label: "CHAT LOST IT", score: 88, c: "from-amber-500/40 to-rose-700/40" },
                ].map((clip, i) => (
                  <motion.div key={clip.t} animate={{ y: [0, i % 2 ? -6 : -12, 0] }} transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }} className={`relative aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b ${clip.c}`}>
                    <div className="absolute inset-x-1.5 top-1.5 h-[38%] rounded-md border border-white/10 bg-white/10 backdrop-blur-sm"><div className="grid h-full place-items-center text-[8px] text-white/70">FACECAM</div></div>
                    <div className="absolute inset-x-1.5 bottom-[32%] top-[42%] rounded-md bg-black/30"><div className="grid h-full place-items-center text-[8px] text-white/50">GAMEPLAY</div></div>
                    <div className="absolute inset-x-1 bottom-2 space-y-0.5 text-center"><p className="text-[7px] font-bold leading-tight text-white">{clip.label}</p><p className="text-[6px] text-cyan-200">AI SCORE {clip.score}</p></div>
                    <span className="absolute left-1.5 top-[40%] rounded bg-black/60 px-1 text-[6px] text-white">{clip.t}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="border-y border-white/5 bg-white/[0.015] py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 text-xs font-semibold uppercase tracking-widest text-slate-600">
          <span>Built for</span><span className="text-slate-400">Gaming</span><span className="text-slate-400">Podcasts</span><span className="text-slate-400">IRL streams</span><span className="text-slate-400">Chess</span><span className="text-slate-400">Creators</span>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Everything you need</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">From one long stream to <span className="gradient-text">a week of content</span></h2>
          <p className="mt-4 text-slate-400">A complete pipeline, not a mockup. Real analysis, real edits, real files you can publish.</p>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div key={feature.title} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} variants={{ ...fadeUp, show: { ...fadeUp.show, transition: { delay: i * 0.05 } } }} className="glass card-hover group rounded-2xl p-6">
              <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${feature.color} text-white shadow-lg`}><feature.icon className="h-5 w-5" /></div>
              <h3 className="mt-5 text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="how" className="relative border-y border-white/5 bg-gradient-to-b from-violet-950/20 to-transparent py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">How it works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">Four steps. <span className="gradient-text">Zero manual scrubbing.</span></h2>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <motion.div key={step.n} initial="hidden" whileInView="show" viewport={{ once: true }} variants={{ ...fadeUp, show: { ...fadeUp.show, transition: { delay: i * 0.08 } } }} className="relative rounded-2xl border border-white/10 bg-[#0a0d1a]/70 p-6">
                <span className="absolute right-5 top-4 text-4xl font-black text-white/[0.04]">{step.n}</span>
                <step.icon className="h-6 w-6 text-violet-300" />
                <h3 className="mt-5 font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-300">Intelligent layouts</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Framing that knows where the action is</h2>
            <p className="mt-4 text-slate-400">CLIPFORGE detects the face and picks a layout per moment. Switch between facecam-on-top, face-following crop or a cinematic blurred backdrop — then fine-tune position and zoom in the editor.</p>
            <div className="mt-7 space-y-3">
              {[
                { icon: LayoutGrid, title: "Stack", text: "Facecam above, gameplay below" },
                { icon: ScanFace, title: "Crop", text: "Follows the speaker in a vertical frame" },
                { icon: Layers3, title: "Blur", text: "Full frame over a soft blurred backdrop" },
              ].map((item) => <div key={item.title} className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><item.icon className="h-5 w-5 text-violet-300" /><div><p className="text-sm font-semibold text-white">{item.title}</p><p className="text-xs text-slate-400">{item.text}</p></div></div>)}
            </div>
          </div>
          <div className="glass rounded-3xl p-6">
            <div className="grid grid-cols-3 gap-3">
              <div className="aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-violet-900/60 to-slate-900 p-1.5"><div className="h-[38%] rounded bg-gradient-to-br from-fuchsia-500/50 to-violet-700/40" /><div className="mt-1.5 h-[58%] rounded bg-slate-800/80" /><p className="mt-1 text-center text-[8px] text-white/70">STACK</p></div>
              <div className="aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-blue-900/40 to-slate-900 p-1.5"><div className="mx-auto mt-10 h-24 w-24 rounded-full bg-gradient-to-br from-cyan-400/60 to-blue-700/50 blur-[1px]" /><p className="mt-16 text-center text-[8px] text-white/70">CROP</p></div>
              <div className="aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-slate-800 to-slate-950 p-1.5"><div className="h-full rounded bg-gradient-to-br from-violet-500/20 to-transparent blur-[3px]" /><p className="-mt-16 text-center text-[8px] text-white/70">BLUR</p></div>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-xs"><span className="text-slate-400">Detected facecam</span><span className="font-mono text-violet-200">x .72 · y .00 · w .28 · h .30</span></div>
          </div>
        </div>
      </section>

      <section id="pricing" className="border-y border-white/5 bg-white/[0.015] py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Pricing</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">Start free. Scale when it pays.</h2>
          </div>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {site.plans.map((plan) => (
              <div key={plan.name} className={`relative rounded-2xl border p-7 ${plan.featured ? "border-violet-400/40 bg-gradient-to-b from-violet-500/15 to-transparent shadow-glow" : "glass"}`}>
                {plan.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Most popular</span>}
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <div className="mt-4 flex items-end gap-2"><span className="text-4xl font-extrabold text-white">{plan.price}</span><span className="pb-1 text-xs text-slate-500">{plan.note}</span></div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => <li key={f} className="flex items-center gap-2 text-sm text-slate-300"><Check className="h-4 w-4 text-emerald-400" />{f}</li>)}
                </ul>
                {plan.price.toLowerCase() === "free" || plan.price === "0" || plan.price === "$0" ? (
                  <Link href="/signup" className={`mt-8 w-full ${plan.featured ? "btn-primary" : "btn-secondary"}`}>{plan.cta}</Link>
                ) : (
                  <button onClick={() => openPurchase(plan.name)} className={`mt-8 w-full ${plan.featured ? "btn-primary" : "btn-secondary"}`}>{plan.cta}</button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">{site.footerNote}</p>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
        <div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">FAQ</p><h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Good questions</h2></div>
        <div className="mt-10 space-y-3">
          {faqs.map((faq, i) => (
            <div key={faq.q} className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025]">
              <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-white" onClick={() => setOpenFaq(openFaq === i ? null : i)}>{faq.q}<ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${openFaq === i ? "rotate-180" : ""}`} /></button>
              {openFaq === i && <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-5 pb-5 text-sm leading-relaxed text-slate-400">{faq.a}</motion.p>}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-600/20 via-purple-700/10 to-blue-600/20 px-6 py-16 text-center">
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-[80px]" /><div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-blue-500/20 blur-[80px]" />
          <Clapperboard className="mx-auto h-8 w-8 text-violet-200" />
          <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">{site.heroTitle}</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300/80">{site.heroSubtitle}</p>
          <Link href="/signup" className="btn-primary mt-8">Start Creating Free <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-5 text-xs text-slate-500 sm:flex-row sm:px-8">
          <Logo />
          <p>© 2026 CLIPFORGE AI. Built for authorized content only.</p>
          <div className="flex gap-5"><a href="#features" className="hover:text-white">Features</a><a href="#pricing" className="hover:text-white">Pricing</a><Link href="/login" className="hover:text-white">Sign in</Link></div>
        </div>
      </footer>
      {purchasePlan && <PurchaseModal plan={purchasePlan} payments={site.payments} onClose={() => setPurchasePlan(null)} />}
    </div>
  );
}
