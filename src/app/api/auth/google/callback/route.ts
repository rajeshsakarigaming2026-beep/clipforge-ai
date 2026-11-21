import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAppUrl } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GoogleUser = { sub?: string; email?: string; name?: string; email_verified?: boolean; picture?: string };

export async function GET(request: NextRequest) {
  const fail = () => {
    const response = NextResponse.redirect(new URL("/login?error=google", getAppUrl()));
    response.cookies.delete("cf_oauth");
    return response;
  };
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const stored = request.cookies.get("cf_oauth")?.value || "";
  const [expectedState, verifier, mode = "login", silent = "0"] = stored.split(".");
  if (error && silent === "1") {
    const response = NextResponse.redirect(new URL(`/api/auth/google?mode=${mode}`, getAppUrl()));
    response.cookies.delete("cf_oauth");
    return response;
  }
  if (!code || !state || !expectedState || !verifier || state !== expectedState) return fail();

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId) return fail();
  const body: Record<string, string> = {
    code,
    client_id: clientId,
    redirect_uri: `${getAppUrl()}/api/auth/google/callback`,
    grant_type: "authorization_code",
    code_verifier: verifier,
  };
  if (clientSecret) body.client_secret = clientSecret;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) return fail();

    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const info: GoogleUser = await infoRes.json();
    const email = typeof info.email === "string" ? info.email.toLowerCase().trim() : "";
    if (!infoRes.ok || !email || info.email_verified === false) return fail();

    let user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
    if (!user) {
      const grant = await prisma.emailAccess.findUnique({ where: { email } });
      user = await prisma.user.create({
        data: {
          email,
          name: info.name || email.split("@")[0],
          passwordHash: await hashPassword(randomBytes(32).toString("hex")),
          settings: grant ? { create: { plan: grant.plan, paid: grant.paid, accessExpiresAt: grant.accessExpiresAt } } : { create: {} },
        },
        select: { id: true, email: true, name: true },
      });
    }
    await createSession(user.id);
    const response = NextResponse.redirect(new URL("/dashboard", getAppUrl()));
    response.cookies.delete("cf_oauth");
    return response;
  } catch {
    return fail();
  }
}
