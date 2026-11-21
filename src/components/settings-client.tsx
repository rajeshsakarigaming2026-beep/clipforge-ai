"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Settings2, Palette, HardDrive, ShieldCheck, LogOut, Check } from "lucide-react";

type SettingsData = {
  captionColor: string; highlightColor: string; fontFamily: string; layout: string;
  clipsPerVideo: number; language: string; autoMusic: boolean;
};

export default function SettingsPage({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [health, setHealth] = useState<{ storage: string; checks: Record<string, boolean> } | null>(null);

  useEffect(() => {
    void fetch("/api/settings").then((r) => r.json()).then((d) => setSettings(d.settings || {
      captionColor: "#FFFFFF", highlightColor: "#FFD400", fontFamily: "Arial Black",
      layout: "auto", clipsPerVideo: 3, language: "auto", autoMusic: true,
    }));
    void fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => undefined);
  }, []);

  function set<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  async function save() {
    if (!settings) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save settings");
      setMessage("Preferences saved. New projects will use them.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save"); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login"); router.refresh();
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Settings</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Workspace settings</h1>
      <p className="mt-1 text-sm text-slate-400">Defaults for new projects and information about this installation.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {!settings ? <div className="glass grid place-items-center rounded-2xl py-20"><Loader2 className="h-6 w-6 animate-spin text-violet-300" /></div> : (
            <>
              <div className="glass rounded-2xl p-5 sm:p-6">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Settings2 className="h-4 w-4 text-violet-300" /> Processing defaults</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div><label className="label">Clips per video</label><select value={settings.clipsPerVideo} onChange={(e) => set("clipsPerVideo", Number(e.target.value))} className="input"><option value={3}>3 clips</option><option value={4}>4 clips</option><option value={5}>5 clips</option><option value={6}>6 clips</option></select></div>
                  <div><label className="label">Default layout</label><select value={settings.layout} onChange={(e) => set("layout", e.target.value)} className="input"><option value="auto">Auto detect</option><option value="stack">Facecam on top</option><option value="crop">Follow face</option><option value="blur">Blurred backdrop</option></select></div>
                  <div><label className="label">Speech language</label><select value={settings.language} onChange={(e) => set("language", e.target.value)} className="input"><option value="auto">Detect automatically</option><option value="en">English</option><option value="hi">Hindi</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="pt">Portuguese</option></select></div>
                  <div><label className="label">Caption font</label><input value={settings.fontFamily} onChange={(e) => set("fontFamily", e.target.value)} className="input" /></div>
                </div>
              </div>
              <div className="glass rounded-2xl p-5 sm:p-6">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Palette className="h-4 w-4 text-violet-300" /> Caption branding</h2>
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div><label className="label">Caption color</label><input type="color" value={settings.captionColor} onChange={(e) => set("captionColor", e.target.value)} className="h-12 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent p-1" /></div>
                  <div><label className="label">Keyword highlight</label><input type="color" value={settings.highlightColor} onChange={(e) => set("highlightColor", e.target.value)} className="h-12 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent p-1" /></div>
                </div>
                <div className="mt-5 rounded-xl border border-white/5 bg-black/20 p-5 text-center text-lg font-extrabold"><span style={{ color: settings.captionColor }}>THIS WAS </span><span style={{ color: settings.highlightColor }}>INSANE</span></div>
              </div>
              {message && <p className="flex items-center gap-2 text-sm text-emerald-300"><Check className="h-4 w-4" />{message}</p>}
              {error && <p className="text-sm text-red-300">{error}</p>}
              <button onClick={save} disabled={busy} className="btn-primary">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save preferences</button>
            </>
          )}
        </div>
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">Account</h2>
            <div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-500">Name</span><span className="text-slate-200">{user.name}</span></div><div className="flex justify-between"><span className="text-slate-500">Email</span><span className="text-slate-200">{user.email}</span></div><div className="flex justify-between"><span className="text-slate-500">Auth</span><span className="text-emerald-300">Local session</span></div></div>
            <button onClick={logout} className="btn-secondary mt-6 w-full !py-2.5 !text-xs"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
          </div>
          <div className="glass rounded-2xl p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><HardDrive className="h-4 w-4 text-blue-300" /> Installation</h2>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Storage driver</span><span className="text-slate-200">{health?.storage || "…"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Database</span><span className={health?.checks.database ? "text-emerald-300" : "text-red-300"}>{health?.checks.database ? "Connected" : "Unavailable"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Video engine</span><span className="text-emerald-300">FFmpeg</span></div>
              <div className="flex justify-between"><span className="text-slate-500">AI provider</span><span className="text-slate-200">Local Whisper</span></div>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">API keys are never sent to the browser. Configure optional providers through environment variables on the server.</p>
          </div>
          <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.07] p-5">
            <ShieldCheck className="h-5 w-5 text-violet-300" /><p className="mt-3 text-sm font-semibold text-white">Responsible clipping</p><p className="mt-1.5 text-xs leading-relaxed text-slate-400">Only process videos you are authorized to edit. Respect creator clipping programs, copyright and platform terms. CLIPFORGE does not bypass access restrictions or DRM.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
