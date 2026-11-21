import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const clean = line.trim();
    if (!clean || clean.startsWith("#")) continue;
    const index = clean.indexOf("=");
    if (index === -1) continue;
    const key = clean.slice(0, index).trim();
    const value = clean.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const bcrypt = await import("bcryptjs");
  const hash = (bcrypt as unknown as { hash?: typeof import("bcryptjs").hash }).hash
    || (bcrypt as unknown as { default: typeof import("bcryptjs") }).default.hash;
  const prisma = new PrismaClient();
  const email = "demo@clipforge.ai";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name: "Demo Creator",
        email,
        passwordHash: await hash("demo1234", 12),
        settings: { create: { clipsPerVideo: 3, plan: "creator", paid: true } },
      },
    });
    console.log("Created demo account: demo@clipforge.ai / demo1234");
  } else {
    console.log("Demo account already exists.");
  }

  const adminEmail = "admin@clipforge.ai";
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    await prisma.user.create({
      data: { name: "Administrator", email: adminEmail, passwordHash: await hash("admin123", 12), settings: { create: { clipsPerVideo: 3 } } },
    });
    console.log("Created admin account: admin@clipforge.ai / admin123");
  }

  await prisma.siteSettings.upsert({
    where: { id: "site" },
    create: { id: "site", data: JSON.stringify({
      siteName: "CLIPFORGE AI",
      heroTitle: "Turn Long Livestreams Into Viral Shorts.",
      heroSubtitle: "AI finds your best moments. Automatically edits them into scroll-stopping videos with facecam framing, captions and clean audio — ready for Shorts, Reels and TikTok.",
      footerNote: "This build runs processing locally and does not charge or require payment details.",
      plans: [
        { name: "Starter", price: "Free", note: "for your first experiments", features: ["3 clips per video", "Local AI processing", "Word-by-word captions", "720p preview renders"], cta: "Start for free" },
        { name: "Creator", price: "$19", note: "per month, billed yearly", features: ["Unlimited videos", "Up to 6 clips per video", "1080×1920 exports", "Full editor + re-renders", "Priority processing"], cta: "Go Creator", featured: true },
        { name: "Studio", price: "$49", note: "per month, billed yearly", features: ["Everything in Creator", "Team workspaces", "S3-compatible storage", "Custom caption branding", "API access"], cta: "Talk to us" },
      ],
      payments: [
        { label: "PayPal", url: "https://www.paypal.com/", enabled: true, type: "link" },
        { label: "PayPal (Alternate)", url: "https://www.paypal.com/", enabled: true, type: "link" },
        { label: "eSewa", url: "", enabled: true, type: "esewa", number: "", qr: "" },
      ],
    }) },
    update: {},
  });
  console.log("Site settings ready. Admin panel: /admin");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
