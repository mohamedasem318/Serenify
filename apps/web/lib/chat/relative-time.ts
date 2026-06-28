/**
 * Client-side relative timestamp (FR-015a). Rendered in the browser to avoid the
 * server-timezone issue (BACKLOG #53): the same ISO instant reads in the viewer's
 * local frame. Calm, lowercase phrasing to match the surface voice.
 */
export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const then = new Date(iso);
  const ms = now.getTime() - then.getTime();
  if (Number.isNaN(ms)) return "";

  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 45) return "just now";
  if (min < 60) return min <= 1 ? "a minute ago" : `${min} minutes ago`;
  if (hr < 24) return hr === 1 ? "an hour ago" : `${hr} hours ago`;
  if (day === 1) return "yesterday";
  if (day < 7) return `${day} days ago`;

  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
