export const CLOUD_APP_URL = process.env.NEXT_PUBLIC_CLOUD_APP_URL || "https://clipforge-ai.onrender.com";

export type Plan = {
  name: string;
  price: string;
  note: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

export type PaymentMethod = {
  label: string;
  url: string;
  enabled: boolean;
  type?: "link" | "esewa";
  number?: string;
  qr?: string;
};

export type SiteData = {
  siteName: string;
  heroTitle: string;
  heroSubtitle: string;
  plans: Plan[];
  payments: PaymentMethod[];
  footerNote: string;
};

export const DEFAULT_SITE: SiteData = {
  siteName: "CLIPFORGE AI",
  heroTitle: "Your next 10 clips are hiding in that stream.",
  heroSubtitle: "Paste a link. CLIPFORGE listens, finds the loudest moments and edits real 9:16 shorts with captions and facecam framing.",
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
  footerNote: "This build runs processing locally and does not charge or require payment details.",
};

export function parseSite(raw: string | null | undefined): SiteData {
  if (!raw) return DEFAULT_SITE;
  try {
    const parsed = JSON.parse(raw) as Partial<SiteData>;
    return {
      ...DEFAULT_SITE,
      ...parsed,
      plans: Array.isArray(parsed.plans) && parsed.plans.length ? parsed.plans : DEFAULT_SITE.plans,
      payments: Array.isArray(parsed.payments) && parsed.payments.length ? parsed.payments : DEFAULT_SITE.payments,
    };
  } catch {
    return DEFAULT_SITE;
  }
}
