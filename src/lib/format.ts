export function formatPercent(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

/** mm:ss elapsed time display for the session timer. */
export function formatElapsed(startedAt: number | null, now: number): string {
  if (startedAt === null) return "00:00";
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
