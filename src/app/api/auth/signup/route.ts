import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { signupSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid details" }, { status: 400 });
    }
    const { name, email, password } = parsed.data;
    const normalized = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    if (existing) return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    const grant = await prisma.emailAccess.findUnique({ where: { email: normalized } });
    const user = await prisma.user.create({
      data: {
        name,
        email: normalized,
        passwordHash: await hashPassword(password),
        settings: grant ? { create: { plan: grant.plan, paid: grant.paid, accessExpiresAt: grant.accessExpiresAt } } : { create: {} },
      },
      select: { id: true, email: true, name: true },
    });
    await createSession(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    console.error("SIGNUP ERROR", error);
    return NextResponse.json({ error: "Could not create the account" }, { status: 500 });
  }
}
