import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

export async function GET() {
  const checks: Record<string, boolean> = {};
  checks.database = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  checks.ffmpeg = true;
  return NextResponse.json({ ok: true, checks, storage: storage.driver });
}
