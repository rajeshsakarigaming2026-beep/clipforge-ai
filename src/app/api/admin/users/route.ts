import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.email)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, createdAt: true, settings: { select: { plan: true, paid: true, accessExpiresAt: true, clipsPerVideo: true } } },
  });
  return NextResponse.json({ users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString(), accessExpiresAt: u.settings?.accessExpiresAt?.toISOString() || null })) });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.email)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  const plan = ["free", "creator", "studio"].includes(body.plan) ? body.plan : "free";
  const paid = body.paid === true && plan !== "free";
  let accessExpiresAt: Date | null = null;
  if (typeof body.accessExpiresAt === "string" && body.accessExpiresAt.trim()) {
    const parsed = new Date(body.accessExpiresAt);
    if (!Number.isNaN(parsed.getTime())) accessExpiresAt = parsed;
  }
  const settings = await prisma.userSettings.upsert({
    where: { userId: id },
    create: { userId: id, plan, paid, accessExpiresAt },
    update: { plan, paid, accessExpiresAt },
  });
  return NextResponse.json({ ok: true, settings: { ...settings, accessExpiresAt: settings.accessExpiresAt?.toISOString() || null } });
}
