let timer: ReturnType<typeof setInterval> | undefined;

export function register() {
  const url = process.env.WORKER_URL;
  if (timer || process.env.CLOUD_WORKER !== "true" || !url) return;
  const ping = () => void fetch(`${url.replace(/\/$/, "")}/api/health`).catch(() => undefined);
  ping();
  timer = setInterval(ping, 30000);
}
