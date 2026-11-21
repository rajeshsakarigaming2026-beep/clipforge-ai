"use client";

import { useCallback, useState } from "react";
import { Loader2, Plus, Save, Trash2, Inbox } from "lucide-react";
import type { SiteData } from "@/lib/site";

type RequestItem = {
  id: string;
  name: string;
  email: string;
  plan: string;
  message: string | null;
  status: string;
  createdAt: string;
};

type UserAccess = {
  id: string;
  name: string;
  email: string;
  settings: { plan: string; paid: boolean; accessExpiresAt: string | null; clipsPerVideo: number } | null;
  accessExpiresAt: string | null;
};

type Grant = {
  email: string;
  plan: string;
  paid: boolean;
  accessExpiresAt: string | null;
  createdAt: string;
};

export function AdminClient({ initialSite, initialRequests, initialUsers, initialGrants, initialCookiesConfigured }: { initialSite: SiteData; initialRequests: RequestItem[]; initialUsers: UserAccess[]; initialGrants: Grant[]; initialCookiesConfigured: boolean }) {
  const [site, setSite] = useState<SiteData>(initialSite);
  const [cookies, setCookies] = useState("");
  const [cookiesConfigured, setCookiesConfigured] = useState(initialCookiesConfigured);
  const [cookiesBusy, setCookiesBusy] = useState(false);
  const [requests, setRequests] = useState<RequestItem[]>(initialRequests);
  const [users, setUsers] = useState<UserAccess[]>(initialUsers);
  const [grants, setGrants] = useState<Grant[]>(initialGrants);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantPlan, setGrantPlan] = useState("creator");
  const [grantExpiry, setGrantExpiry] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);
  const [accessBusy, setAccessBusy] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    const res = await fetch("/api/purchase/list");
    const data = await res.json();
    if (res.ok) setRequests(data.requests || []);
  }, []);

  async function save() {
    setBusy(true); setMessage(""); setError("");
    try {
      const res = await fetch("/api/site", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(site) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setSite(data.site);
      setMessage("Website content and payment options saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function saveCookies() {
    setCookiesBusy(true); setMessage(""); setError("");
    try {
      const res = await fetch("/api/admin/youtube-cookies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookies }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save cookies");
      setCookiesConfigured(true);
      setCookies("");
      setMessage("YouTube cookies saved. New link jobs will use them.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save cookies");
    } finally {
      setCookiesBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/purchase/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    await loadRequests();
  }

  async function remove(id: string) {
    await fetch(`/api/purchase/${id}`, { method: "DELETE" });
    await loadRequests();
  }

  function updateUser(id: string, key: "plan" | "paid" | "accessExpiresAt", value: string | boolean | null) {
    setUsers((prev) => prev.map((u) => u.id === id ? {
      ...u,
      settings: { plan: "free", paid: false, accessExpiresAt: null, clipsPerVideo: 3, ...(u.settings || {}), [key]: value },
    } : u));
  }

  async function saveUser(id: string) {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    setAccessBusy(id); setError(""); setMessage("");
    try {
      const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        id,
        plan: target.settings?.plan || "free",
        paid: Boolean(target.settings?.paid),
        accessExpiresAt: target.settings?.accessExpiresAt || null,
      }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update access");
      setMessage(`Access updated for ${target.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update access");
    } finally {
      setAccessBusy("");
    }
  }

  async function grantAccess() {
    setGrantBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/admin/grant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        email: grantEmail,
        plan: grantPlan,
        accessExpiresAt: grantExpiry ? new Date(grantExpiry).toISOString() : null,
      }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not grant access");
      const next = { email: data.email, plan: grantPlan, paid: true, accessExpiresAt: grantExpiry ? new Date(grantExpiry).toISOString() : null, createdAt: new Date().toISOString() };
      setGrants((prev) => [next, ...prev.filter((g) => g.email !== next.email)]);
      setUsers((prev) => prev.map((u) => u.email === next.email ? { ...u, settings: { plan: next.plan, paid: true, accessExpiresAt: next.accessExpiresAt, clipsPerVideo: u.settings?.clipsPerVideo || 3 } } : u));
      setMessage(data.appliedToExistingAccount ? `Paid access activated for ${data.email}.` : `Access saved for ${data.email}. It will activate when they sign up.`);
      setGrantEmail(""); setGrantExpiry("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not grant access");
    } finally {
      setGrantBusy(false);
    }
  }

  function updatePlan(index: number, key: string, value: string | boolean | string[]) {
    setSite((prev) => ({ ...prev, plans: prev.plans.map((p, i) => i === index ? { ...p, [key]: value } : p) }));
  }

  function updatePayment(index: number, key: string, value: string | boolean) {
    setSite((prev) => ({ ...prev, payments: prev.payments.map((p, i) => i === index ? { ...p, [key]: value } : p) }));
  }

  function readQr(file: File | undefined, index: number) {
    if (!file) return;
    if (file.size > 2_000_000) { setError("QR image must be under 2 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => updatePayment(index, "qr", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <div className="space-y-6">
        <section className="glass rounded-2xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold">Website content</h2>
          <div className="mt-5 grid gap-4">
            <label className="block"><span className="label">Site name</span><input className="input" value={site.siteName} onChange={(e) => setSite({ ...site, siteName: e.target.value })} /></label>
            <label className="block"><span className="label">Hero title</span><textarea className="input min-h-20" value={site.heroTitle} onChange={(e) => setSite({ ...site, heroTitle: e.target.value })} /></label>
            <label className="block"><span className="label">Hero subtitle</span><textarea className="input min-h-24" value={site.heroSubtitle} onChange={(e) => setSite({ ...site, heroSubtitle: e.target.value })} /></label>
            <label className="block"><span className="label">Pricing footnote</span><input className="input" value={site.footerNote} onChange={(e) => setSite({ ...site, footerNote: e.target.value })} /></label>
          </div>
        </section>

        <section className="glass rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Pricing cards</h2><button className="btn-secondary !py-1.5 !text-xs" onClick={() => setSite({ ...site, plans: [...site.plans, { name: "New plan", price: "$0", note: "", features: [], cta: "Choose plan" }] })}><Plus className="h-3 w-3" /> Add</button></div>
          <div className="mt-5 space-y-4">
            {site.plans.map((plan, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <input className="input" aria-label="Plan name" value={plan.name} onChange={(e) => updatePlan(i, "name", e.target.value)} />
                  <input className="input" aria-label="Price" value={plan.price} onChange={(e) => updatePlan(i, "price", e.target.value)} />
                  <input className="input" aria-label="Note" value={plan.note} onChange={(e) => updatePlan(i, "note", e.target.value)} />
                  <input className="input" aria-label="Button text" value={plan.cta} onChange={(e) => updatePlan(i, "cta", e.target.value)} />
                </div>
                <label className="mt-3 block"><span className="label">Features (one per line)</span><textarea className="input min-h-20" value={plan.features.join("\n")} onChange={(e) => updatePlan(i, "features", e.target.value.split("\n"))} /></label>
                <label className="mt-3 flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={Boolean(plan.featured)} onChange={(e) => updatePlan(i, "featured", e.target.checked)} /> Highlight this plan</label>
                <button className="mt-3 text-xs text-red-300" onClick={() => setSite({ ...site, plans: site.plans.filter((_, j) => j !== i) })}><Trash2 className="mr-1 inline h-3 w-3" />Remove</button>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Purchase / payment options</h2><button className="btn-secondary !py-1.5 !text-xs" onClick={() => setSite({ ...site, payments: [...site.payments, { label: "New option", url: "", enabled: true, type: "link" }] })}><Plus className="h-3 w-3" /> Add</button></div>
          <p className="mt-1 text-xs text-slate-500">Link options open a URL. eSewa shows your QR code and number in the purchase popup.</p>
          <div className="mt-5 space-y-4">
            {site.payments.map((pay, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <input className="input" aria-label="Option label" value={pay.label} onChange={(e) => updatePayment(i, "label", e.target.value)} />
                  <select className="input" aria-label="Option type" value={pay.type || "link"} onChange={(e) => updatePayment(i, "type", e.target.value)}><option value="link">Payment link</option><option value="esewa">eSewa QR + number</option></select>
                  <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={pay.enabled} onChange={(e) => updatePayment(i, "enabled", e.target.checked)} /> Enabled</label>
                </div>
                {pay.type === "esewa" ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block"><span className="label">eSewa number</span><input className="input" placeholder="98XXXXXXXX" value={pay.number || ""} onChange={(e) => updatePayment(i, "number", e.target.value)} /></label>
                    <label className="block"><span className="label">QR image (PNG/JPG, max 2 MB)</span><input type="file" accept="image/*" className="input !py-2" onChange={(e) => readQr(e.target.files?.[0], i)} /></label>
                    <label className="block sm:col-span-2"><span className="label">Or paste QR image URL</span><input className="input" placeholder="https://… or data:image/…" value={pay.qr || ""} onChange={(e) => updatePayment(i, "qr", e.target.value)} /></label>
                    {pay.qr && <div role="img" aria-label="QR preview" className="h-28 w-28 rounded-lg border border-white/10 bg-white bg-contain bg-center bg-no-repeat p-1" style={{ backgroundImage: `url("${pay.qr.replace(/"/g, "")}")` }} />}
                  </div>
                ) : (
                  <input className="input mt-3" aria-label="Payment URL" placeholder="https://…" value={pay.url} onChange={(e) => updatePayment(i, "url", e.target.value)} />
                )}
                <button className="mt-3 text-xs text-red-300" onClick={() => setSite({ ...site, payments: site.payments.filter((_, j) => j !== i) })}><Trash2 className="mr-1 inline h-3 w-3" />Remove</button>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">YouTube cookies</h2><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${cookiesConfigured ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-slate-400"}`}>{cookiesConfigured ? "Configured" : "Not set"}</span></div>
          <p className="mt-1 text-xs text-slate-500">Paste the Cookie header from DevTools on youtube.com, or a Netscape cookies.txt export. Needed for live YouTube URLs from cloud datacenter IPs.</p>
          <textarea className="input mt-4 min-h-28 font-mono !text-xs" placeholder="Cookie: VISITOR_INFO1_LIVE=…; YSC=…; …" value={cookies} onChange={(e) => setCookies(e.target.value)} />
          <button disabled={cookiesBusy || !cookies.trim()} onClick={saveCookies} className="btn-secondary mt-3 !py-2 !text-xs">{cookiesBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save cookies"}</button>
        </section>

        <section className="glass rounded-2xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold">Grant access by email</h2>
          <p className="mt-1 text-xs text-slate-500">Enter the buyer&apos;s email, choose a plan, and grant. If they have not signed up yet, access is saved and activates automatically when they register with that exact email.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-end">
            <label className="block"><span className="label">Email address</span><input className="input !py-2 !text-xs" type="email" placeholder="buyer@example.com" value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} /></label>
            <label className="block"><span className="label">Plan</span><select className="input !py-2 !text-xs" value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)}><option value="creator">Creator</option><option value="studio">Studio</option></select></label>
            <label className="block"><span className="label">Expires (optional)</span><input className="input !py-2 !text-xs" type="date" value={grantExpiry} onChange={(e) => setGrantExpiry(e.target.value)} /></label>
            <button disabled={grantBusy || !grantEmail.trim()} onClick={grantAccess} className="btn-primary !py-2 !text-xs">{grantBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Grant access"}</button>
          </div>
          {grants.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{grants.map((g) => <span key={g.email} className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-200">{g.email} · {g.plan}</span>)}</div>}
        </section>

        <section className="glass rounded-2xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold">Customer access</h2>
          <p className="mt-1 text-xs text-slate-500">After payment, choose the plan, tick Paid, optionally set an expiry date, then save. Free accounts are limited to 2 projects.</p>
          <div className="mt-5 space-y-3">
            {users.map((u) => (
              <div key={u.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-white">{u.name}</p><p className="text-xs text-slate-400">{u.email}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${u.settings?.paid ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-slate-400"}`}>{u.settings?.paid ? "Paid" : "Free"}</span></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <select className="input !py-2 !text-xs" value={u.settings?.plan || "free"} onChange={(e) => updateUser(u.id, "plan", e.target.value)}><option value="free">Free</option><option value="creator">Creator</option><option value="studio">Studio</option></select>
                  <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={Boolean(u.settings?.paid)} onChange={(e) => updateUser(u.id, "paid", e.target.checked)} /> Paid access</label>
                  <input type="date" className="input !py-2 !text-xs" aria-label="Access expiry" value={(u.settings?.accessExpiresAt || "").slice(0, 10)} onChange={(e) => updateUser(u.id, "accessExpiresAt", e.target.value ? new Date(e.target.value).toISOString() : null)} />
                  <button disabled={accessBusy === u.id} onClick={() => saveUser(u.id)} className="btn-secondary !py-2 !text-xs">{accessBusy === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {message && <p className="text-sm text-emerald-300">{message}</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button onClick={save} disabled={busy} className="btn-primary">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save all changes</button>
      </div>

      <section className="glass h-fit rounded-2xl p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Inbox className="h-4 w-4 text-violet-300" /> Purchase enquiries <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs">{requests.length}</span></h2>
        <div className="mt-5 space-y-3">
          {requests.length === 0 && <p className="text-sm text-slate-500">No purchase requests yet. They will appear here when visitors click a paid plan.</p>}
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs">
              <div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-white">{r.name}</p><p className="text-slate-400">{r.email}</p></div><span className="rounded-full bg-white/5 px-2 py-1 text-slate-300">{r.plan}</span></div>
              {r.message && <p className="mt-2 text-slate-300">{r.message}</p>}
              <p className="mt-2 text-slate-600">{new Date(r.createdAt).toLocaleString()}</p>
              <div className="mt-3 flex gap-2">
                <select className="input !py-1.5 !text-xs" value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select>
                <button className="rounded-lg border border-emerald-400/20 px-3 text-emerald-300" onClick={() => { setGrantEmail(r.email); setGrantPlan(r.plan.toLowerCase() === "studio" ? "studio" : "creator"); }}>Grant</button>
                <button className="rounded-lg border border-red-400/20 px-3 text-red-300" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
