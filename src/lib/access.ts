export type AccessSettings = {
  plan?: string | null;
  paid?: boolean | null;
  accessExpiresAt?: Date | string | null;
} | null;

export function hasPaidAccess(settings: AccessSettings) {
  if (!settings?.paid) return false;
  if (!settings.accessExpiresAt) return true;
  return new Date(settings.accessExpiresAt).getTime() > Date.now();
}

export function accessLabel(settings: AccessSettings) {
  if (!hasPaidAccess(settings)) return "Free plan";
  const plan = (settings?.plan || "creator").toLowerCase();
  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)} plan`;
}
