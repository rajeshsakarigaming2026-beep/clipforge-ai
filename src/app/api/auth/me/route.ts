import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });
  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id }, select: { plan: true, paid: true, accessExpiresAt: true } });
  return NextResponse.json({ user: { ...user, plan: settings?.plan || "free", paid: Boolean(settings?.paid) } });
}
