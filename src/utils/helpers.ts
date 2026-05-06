export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 50%, 35%)`;
}

export const ACCENT_PRESETS = [
  { id: "modrinth",       label: "Mint Green",  hex: "#1bd96a" },
  { id: "sapphire",       label: "Sapphire",    hex: "#2563eb" },
  { id: "violet",        label: "Violet",     hex: "#8b5cf6" },
  { id: "rose",          label: "Rose",       hex: "#f43f5e" },
  { id: "amber",          label: "Amber",      hex: "#f59e0b" },
  { id: "cyan",          label: "Cyan",      hex: "#06b6d4" },
  { id: "orange",        label: "Orange",    hex: "#f97316" },
  { id: "fuchsia",       label: "Fuchsia",   hex: "#d946ef" },
  { id: "emerald",       label: "Emerald",   hex: "#10b981" },
  { id: "indigo",        label: "Indigo",    hex: "#6366f1" },
];

export function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}