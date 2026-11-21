import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.email)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const plan = ["creator", "studio"].includes(body.plan) ? body.plan : "creator";
  let accessExpiresAt: Date | null = null;
  if (typeof body.accessExpiresAt === "string" && body.accessExpiresAt.trim()) {
    const parsed = new Date(body.accessExpiresAt);
    if (!Number.isNaN(parsed.getTime())) accessExpiresAt = parsed;
  }

  await prisma.emailAccess.upsert({
    where: { email },
    create: { email, plan, paid: true, accessExpiresAt },
    update: { plan, paid: true, accessExpiresAt },
  });

  const account = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (account) {
    await prisma.userSettings.upsert({
      where: { userId: account.id },
      create: { userId: account.id, plan, paid: true, accessExpiresAt },
      update: { plan, paid: true, accessExpiresAt },
    });
  }

  return NextResponse.json({ ok: true, appliedToExistingAccount: Boolean(account), email });
}
