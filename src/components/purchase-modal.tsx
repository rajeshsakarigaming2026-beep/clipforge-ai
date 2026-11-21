"use client";

import { useState } from "react";
import { X, Loader2, ArrowUpRight, Check } from "lucide-react";
import type { PaymentMethod } from "@/lib/site";

export function PurchaseModal({ plan, payments, onClose }: { plan: string; payments: PaymentMethod[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const active = payments.filter((p) => p.enabled);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/purchase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, plan, message }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send request");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0d18] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Purchase</p><h2 className="mt-2 text-2xl font-bold text-white">{plan} plan</h2></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button></div>

        {done ? (
          <div className="mt-8 text-center"><Check className="mx-auto h-10 w-10 text-emerald-400" /><p className="mt-4 font-semibold text-white">Request received</p><p className="mt-2 text-sm text-slate-400">We have saved your enquiry. Our team will contact you at {email}.</p><button onClick={onClose} className="btn-primary mt-6">Close</button></div>
        ) : (
          <>
            <p className="mt-4 text-sm text-slate-400">Choose a payment option, or send us a purchase enquiry and we will get in touch.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {active.map((pay, i) => {
                if (pay.type === "esewa") {
                  return (
                    <div key={i} className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.07] p-4">
                      <p className="text-sm font-semibold text-white">{pay.label}</p>
                      {pay.qr ? (
                        <div role="img" aria-label={`${pay.label} QR code`} className="mx-auto mt-3 h-36 w-36 rounded-lg bg-white bg-contain bg-center bg-no-repeat p-2" style={{ backgroundImage: `url("${pay.qr.replace(/"/g, "")}")` }} />
                      ) : (
                        <p className="mt-3 rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-slate-500">QR code not set yet — add it in Admin.</p>
                      )}
                        {pay.number ? (
                          <div className="mt-3 select-text rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center text-xs text-white" title="Select to copy">{pay.number}</div>
                        ) : (
                        <p className="mt-3 text-center text-xs text-slate-500">Number not set yet — add it in Admin.</p>
                      )}
                    </div>
                  );
                }
                return pay.url ? (
                  <a key={i} href={pay.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500/20">{pay.label}<ArrowUpRight className="h-4 w-4" /></a>
                ) : (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-500">{pay.label} — link not set</div>
                );
              })}
            </div>

            <form onSubmit={submit} className="mt-6 space-y-3 border-t border-white/10 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Or request a purchase call</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input required className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                <input required type="email" className="input" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <textarea className="input min-h-20" placeholder="Anything you want us to know?" value={message} onChange={(e) => setMessage(e.target.value)} />
              {error && <p className="text-sm text-red-300">{error}</p>}
              <button disabled={busy} className="btn-primary w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send purchase request"}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
