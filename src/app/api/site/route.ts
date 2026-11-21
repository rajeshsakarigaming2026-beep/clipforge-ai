import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { DEFAULT_SITE, parseSite, type SiteData } from "@/lib/site";

export async function GET() {
  const row = await prisma.siteSettings.findUnique({ where: { id: "site" } });
  return NextResponse.json({ site: parseSite(row?.data) });
}

function clean(value: SiteData): SiteData {
  const text = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
  return {
    siteName: text(value.siteName, 80) || DEFAULT_SITE.siteName,
    heroTitle: text(value.heroTitle, 300) || DEFAULT_SITE.heroTitle,
    heroSubtitle: text(value.heroSubtitle, 600) || DEFAULT_SITE.heroSubtitle,
    footerNote: text(value.footerNote, 400),
    plans: (Array.isArray(value.plans) ? value.plans : DEFAULT_SITE.plans).slice(0, 6).map((p) => ({
      name: text(p.name, 60),
      price: text(p.price, 40),
      note: text(p.note, 100),
      cta: text(p.cta, 60),
      featured: Boolean(p.featured),
      features: (Array.isArray(p.features) ? p.features : []).slice(0, 10).map((f) => text(f, 120)).filter(Boolean),
    })),
    payments: (Array.isArray(value.payments) ? value.payments : DEFAULT_SITE.payments).slice(0, 6).map((p) => {
      const qr = text(p.qr, 2_000_000);
      return {
        label: text(p.label, 60) || "Payment option",
        url: text(p.url, 500),
        enabled: Boolean(p.enabled),
        type: p.type === "esewa" ? "esewa" as const : "link" as const,
        number: text(p.number, 40),
        qr: qr.startsWith("data:image/") || /^https?:\/\//.test(qr) ? qr : "",
      };
    }),
  };
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.email)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const site = clean({ ...DEFAULT_SITE, ...(body as Partial<SiteData>) });
  const row = await prisma.siteSettings.upsert({
    where: { id: "site" },
    create: { id: "site", data: JSON.stringify(site) },
    update: { data: JSON.stringify(site) },
  });
  return NextResponse.json({ site: parseSite(row.data) });
}
