// Order matters: Edge says "Chrome" and "Safari", Chrome says "Safari", an iPhone says "Mac OS X",
// Android says "Linux". The first match wins.
const BROWSERS: [needle: string, label: string][] = [
  ["Edg", "Edge"],
  ["Firefox", "Firefox"],
  ["Chrome", "Chrome"],
  ["Safari", "Safari"],
];

const SYSTEMS: [needle: string, label: string][] = [
  ["iPhone", "iPhone"],
  ["iPad", "iPad"],
  ["Android", "Android"],
  ["Windows", "Windows"],
  ["Mac OS X", "macOS"],
  ["Linux", "Linux"],
];

const MAX_RAW = 40;

function firstMatch(userAgent: string, rules: [string, string][]): string | undefined {
  return rules.find(([needle]) => userAgent.includes(needle))?.[1];
}

export function deviceLabel(userAgent: string | null): string {
  if (userAgent === null) {
    return "—";
  }

  const browser = firstMatch(userAgent, BROWSERS);
  const system = firstMatch(userAgent, SYSTEMS);

  if (browser && system) {
    return `${browser} · ${system}`;
  }

  return userAgent.length > MAX_RAW ? `${userAgent.slice(0, MAX_RAW)}…` : userAgent;
}
