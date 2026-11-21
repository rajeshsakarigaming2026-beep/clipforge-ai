export function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="animate-grid absolute inset-0" />
      <div className="animate-pulse-glow absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-fuchsia-600/10 blur-[120px]" />
      <div className="animate-pulse-glow absolute -right-40 top-0 h-96 w-96 rounded-full bg-blue-600/10 blur-[120px] [animation-delay:1.5s]" />
    </div>
  );
}
