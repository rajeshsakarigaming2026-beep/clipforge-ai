import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

const COOKIE_PATH = "secrets/youtube-cookies.txt";

function normalizeCookies(input: string) {
  const text = input.trim();
  if (text.startsWith("# Netscape") || /\t/.test(text)) return text.endsWith("\n") ? text : `${text}\n`;
  const pairs = text
    .replace(/^Cookie:\s*/i, "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      if (index <= 0) return null;
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()] as const;
    })
    .filter((pair): pair is readonly [string, string] => Boolean(pair && pair[0] && pair[1]));
  if (!pairs.length) throw new Error("Paste a Cookie header or a Netscape cookies.txt file.");
  const lines = pairs.flatMap(([name, value]) => {
    const key = name.replace(/[\t\r\n]/g, "");
    const val = value.replace(/[\t\r\n]/g, "");
    return [
      `.youtube.com\tTRUE\t/\tFALSE\t2147483647\t${key}\t${val}`,
      `.google.com\tTRUE\t/\tFALSE\t2147483647\t${key}\t${val}`,
    ];
  });
  return `# Netscape HTTP Cookie File\n${lines.join("\n")}\n`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ configured: await storage.exists(COOKIE_PATH) });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const input = String(body.cookies || "");
  if (!input.trim()) return NextResponse.json({ error: "Cookies are required." }, { status: 400 });
  if (input.length > 100000) return NextResponse.json({ error: "Cookie data is too large." }, { status: 400 });
  try {
    await storage.write(COOKIE_PATH, Buffer.from(normalizeCookies(input)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save cookies." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, configured: true });
}
