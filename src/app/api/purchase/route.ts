import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 180) : "";
  const plan = typeof body.plan === "string" ? body.plan.trim().slice(0, 80) : "General enquiry";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter your name and a valid email." }, { status: 400 });
  }
  const item = await prisma.purchaseRequest.create({ data: { name, email, plan, message } });
  return NextResponse.json({ ok: true, id: item.id });
}
