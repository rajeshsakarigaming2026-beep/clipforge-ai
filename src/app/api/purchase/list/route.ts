import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.email)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const requests = await prisma.purchaseRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ requests });
}
