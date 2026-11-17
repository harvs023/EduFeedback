/** "Just now", "5 min ago", "3 hours ago", "Yesterday", "4 days ago", then the date. */
export function timeAgo(timestamp: number | undefined, now: number = Date.now()): string {
  if (!timestamp) return "";
  const diff = Math.max(0, now - timestamp);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Full date and time, e.g. "Nov 17, 2026, 3:05 PM". */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
