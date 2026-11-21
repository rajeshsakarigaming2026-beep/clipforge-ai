import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { getAppUrl } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/login?error=google", getAppUrl()));
  const query = new URL(request.url).searchParams;
  const mode = query.get("mode") === "signup" ? "signup" : "login";
  const silent = query.get("silent") === "1";
  const hint = query.get("hint") || "";
  const state = randomBytes(16).toString("hex");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${getAppUrl()}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  if (silent) params.set("prompt", "none");
  if (/^\S+@\S+\.\S+$/.test(hint)) params.set("login_hint", hint);
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.cookies.set("cf_oauth", `${state}.${verifier}.${mode}.${silent ? "1" : "0"}`, { httpOnly: true, sameSite: "lax", secure: getAppUrl().startsWith("https://"), path: "/", maxAge: 600 });
  return response;
}
