import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.email)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = typeof body.status === "string" && ["new", "contacted", "closed"].includes(body.status) ? body.status : "new";
  const item = await prisma.purchaseRequest.update({ where: { id }, data: { status } });
  return NextResponse.json({ request: item });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.email)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  await prisma.purchaseRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
